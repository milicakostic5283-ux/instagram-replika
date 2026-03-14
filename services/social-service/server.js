const http = require("http");
const { URL } = require("url");
const { Pool } = require("pg");
const { isSelfAction, followStatusForPrivacy, decisionToStatus } = require("./rules");

const PORT = Number(process.env.PORT || 8083);

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "insta",
  user: process.env.DB_USER || "insta",
  password: process.env.DB_PASSWORD || "insta"
});

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Id"
  });
  res.end(JSON.stringify(data));
}

function meId(req, url) {
  return Number(req.headers["x-user-id"] || url.searchParams.get("me") || 1);
}

async function blockedEither(a, b) {
  const q = await pool.query(
    `SELECT 1 FROM blocks
     WHERE (blocker_id = $1 AND blocked_id = $2)
        OR (blocker_id = $2 AND blocked_id = $1)
     LIMIT 1`,
    [a, b]
  );
  return q.rowCount > 0;
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return sendJson(res, 200, { ok: true });
  const url = new URL(req.url, "http://localhost");

  try {
    if (req.method === "GET" && url.pathname === "/health") {
      await pool.query("SELECT 1");
      return sendJson(res, 200, { service: "social-service", status: "ok" });
    }

    const followMatch = url.pathname.match(/^\/follow\/(\d+)$/);
    if (followMatch) {
      const targetId = Number(followMatch[1]);
      const currentId = meId(req, url);

      if (isSelfAction(currentId, targetId)) {
        return sendJson(res, 400, { error: "Ne mozes pratiti sebe" });
      }
      if (await blockedEither(currentId, targetId)) {
        return sendJson(res, 403, { error: "Follow nije dozvoljen zbog blokiranja" });
      }

      if (req.method === "POST") {
        const target = await pool.query("SELECT is_private FROM profiles WHERE user_id = $1", [targetId]);
        if (target.rowCount === 0) return sendJson(res, 404, { error: "Target profil ne postoji" });

        const initialStatus = followStatusForPrivacy(Boolean(target.rows[0].is_private));
        await pool.query(
          `INSERT INTO follows (follower_id, following_id, status, created_at, decided_at)
           VALUES ($1, $2, $3, NOW(), CASE WHEN $3 = 'accepted' THEN NOW() ELSE NULL END)
           ON CONFLICT (follower_id, following_id)
           DO UPDATE SET status = EXCLUDED.status, created_at = NOW(), decided_at = CASE WHEN EXCLUDED.status = 'accepted' THEN NOW() ELSE NULL END`,
          [currentId, targetId, initialStatus]
        );

        if (initialStatus === "pending") {
          return sendJson(res, 202, { status: "pending", followerId: currentId, followingId: targetId });
        }
        return sendJson(res, 201, { status: "accepted", followerId: currentId, followingId: targetId });
      }

      if (req.method === "DELETE") {
        await pool.query("DELETE FROM follows WHERE follower_id = $1 AND following_id = $2", [currentId, targetId]);
        return sendJson(res, 200, { status: "unfollowed", followerId: currentId, followingId: targetId });
      }
    }

    if (req.method === "GET" && url.pathname === "/requests") {
      const currentId = meId(req, url);
      const q = await pool.query(
        `SELECT f.follower_id, u.username AS follower_username, f.following_id, f.created_at
         FROM follows f
         JOIN users u ON u.id = f.follower_id
         WHERE f.following_id = $1 AND f.status = 'pending'
         ORDER BY f.created_at DESC`,
        [currentId]
      );
      return sendJson(res, 200, { items: q.rows });
    }

    const requestMatch = url.pathname.match(/^\/requests\/(\d+)\/(accept|reject)$/);
    if (requestMatch && req.method === "POST") {
      const followerId = Number(requestMatch[1]);
      const action = requestMatch[2];
      const currentId = meId(req, url);

      const pending = await pool.query(
        `SELECT 1 FROM follows
         WHERE follower_id = $1 AND following_id = $2 AND status = 'pending'`,
        [followerId, currentId]
      );
      if (pending.rowCount === 0) return sendJson(res, 404, { error: "Pending zahtev nije pronadjen" });

      const nextStatus = decisionToStatus(action);
      await pool.query(
        `UPDATE follows
         SET status = $3,
             decided_at = NOW()
         WHERE follower_id = $1 AND following_id = $2`,
        [followerId, currentId, nextStatus]
      );

      return sendJson(res, 200, { followerId, followingId: currentId, status: nextStatus });
    }

    const statsMatch = url.pathname.match(/^\/stats\/(\d+)$/);
    if (statsMatch && req.method === "GET") {
      const userId = Number(statsMatch[1]);
      const count = await pool.query(
        `SELECT
           (SELECT COUNT(*) FROM follows WHERE following_id = $1 AND status = 'accepted')::int AS followers_count,
           (SELECT COUNT(*) FROM follows WHERE follower_id = $1 AND status = 'accepted')::int AS following_count`,
        [userId]
      );
      return sendJson(res, 200, {
        userId,
        followersCount: count.rows[0].followers_count,
        followingCount: count.rows[0].following_count
      });
    }

    return sendJson(res, 404, { error: "Ruta ne postoji" });
  } catch (err) {
    return sendJson(res, 500, { error: "Server error", detail: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`social-service listening on ${PORT}`);
});
