const http = require("http");
const { URL } = require("url");
const { Pool } = require("pg");

const PORT = Number(process.env.PORT || 8082);

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

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function meId(req, url) {
  return Number(req.headers["x-user-id"] || url.searchParams.get("me") || 1);
}

async function isBlockedEither(a, b) {
  const q = await pool.query(
    `SELECT 1
     FROM blocks
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
      return sendJson(res, 200, { service: "user-service", status: "ok" });
    }

    if (req.method === "GET" && url.pathname === "/me") {
      const viewerId = meId(req, url);
      const q = await pool.query(
        `SELECT u.id, u.email, u.username, p.full_name, p.bio, p.avatar_url, p.is_private
         FROM users u
         JOIN profiles p ON p.user_id = u.id
         WHERE u.id = $1`,
        [viewerId]
      );
      if (q.rowCount === 0) return sendJson(res, 404, { error: "Korisnik nije pronadjen" });
      return sendJson(res, 200, q.rows[0]);
    }

    if (req.method === "PATCH" && url.pathname === "/me") {
      const viewerId = meId(req, url);
      const body = await readBody(req);

      const fullName = body.fullName != null ? String(body.fullName).trim() : null;
      const bio = body.bio != null ? String(body.bio) : null;
      const avatarUrl = body.avatarUrl != null ? String(body.avatarUrl) : null;
      const isPrivate = body.isPrivate;

      await pool.query(
        `UPDATE profiles
         SET full_name = COALESCE($2, full_name),
             bio = COALESCE($3, bio),
             avatar_url = COALESCE($4, avatar_url),
             is_private = COALESCE($5, is_private),
             updated_at = NOW()
         WHERE user_id = $1`,
        [viewerId, fullName, bio, avatarUrl, typeof isPrivate === "boolean" ? isPrivate : null]
      );

      const updated = await pool.query(
        `SELECT u.id, u.email, u.username, p.full_name, p.bio, p.avatar_url, p.is_private
         FROM users u
         JOIN profiles p ON p.user_id = u.id
         WHERE u.id = $1`,
        [viewerId]
      );
      return sendJson(res, 200, updated.rows[0]);
    }

    if (req.method === "GET" && url.pathname === "/search") {
      const viewerId = meId(req, url);
      const q = `%${String(url.searchParams.get("q") || "").trim().toLowerCase()}%`;

      const found = await pool.query(
        `SELECT u.id, u.username, p.full_name, p.bio, p.avatar_url, p.is_private
         FROM users u
         JOIN profiles p ON p.user_id = u.id
         WHERE (
           LOWER(u.username) LIKE $2 OR LOWER(p.full_name) LIKE $2
         )
         AND u.id <> $1
         AND NOT EXISTS (
           SELECT 1 FROM blocks b
           WHERE (b.blocker_id = $1 AND b.blocked_id = u.id)
              OR (b.blocker_id = u.id AND b.blocked_id = $1)
         )
         ORDER BY u.username ASC
         LIMIT 30`,
        [viewerId, q]
      );

      return sendJson(res, 200, { items: found.rows });
    }

    const profileByUsername = url.pathname.match(/^\/([a-zA-Z0-9_\-.]+)$/);
    if (req.method === "GET" && profileByUsername) {
      const username = profileByUsername[1].toLowerCase();
      const viewerId = meId(req, url);

      const profile = await pool.query(
        `SELECT u.id, u.username, p.full_name, p.bio, p.avatar_url, p.is_private
         FROM users u
         JOIN profiles p ON p.user_id = u.id
         WHERE u.username = $1`,
        [username]
      );
      if (profile.rowCount === 0) return sendJson(res, 404, { error: "Profil nije pronadjen" });

      if (await isBlockedEither(viewerId, profile.rows[0].id)) {
        return sendJson(res, 403, { error: "Pristup profilu nije dozvoljen" });
      }

      return sendJson(res, 200, profile.rows[0]);
    }

    const blockMatch = url.pathname.match(/^\/(\d+)\/block$/);
    if (blockMatch) {
      const targetId = Number(blockMatch[1]);
      const viewerId = meId(req, url);
      if (targetId === viewerId) return sendJson(res, 400, { error: "Ne mozes blokirati sebe" });

      if (req.method === "POST") {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          await client.query(
            `INSERT INTO blocks (blocker_id, blocked_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [viewerId, targetId]
          );
          await client.query(
            `DELETE FROM follows
             WHERE (follower_id = $1 AND following_id = $2)
                OR (follower_id = $2 AND following_id = $1)`,
            [viewerId, targetId]
          );
          await client.query("COMMIT");
          return sendJson(res, 201, { blocked: true, blockerId: viewerId, targetId });
        } catch (err) {
          await client.query("ROLLBACK");
          throw err;
        } finally {
          client.release();
        }
      }

      if (req.method === "DELETE") {
        await pool.query(
          `DELETE FROM blocks
           WHERE blocker_id = $1 AND blocked_id = $2`,
          [viewerId, targetId]
        );
        return sendJson(res, 200, { blocked: false, blockerId: viewerId, targetId });
      }
    }

    return sendJson(res, 404, { error: "Ruta ne postoji" });
  } catch (err) {
    return sendJson(res, 500, { error: "Server error", detail: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`user-service listening on ${PORT}`);
});
