const http = require("http");
const { URL } = require("url");
const { Pool } = require("pg");

const PORT = Number(process.env.PORT || 8085);

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

async function canViewPost(viewerId, postId) {
  const q = await pool.query(
    `SELECT p.author_id, pr.is_private
     FROM posts p
     JOIN profiles pr ON pr.user_id = p.author_id
     WHERE p.id = $1`,
    [postId]
  );
  if (q.rowCount === 0) return { ok: false, reason: "NOT_FOUND" };

  const authorId = q.rows[0].author_id;
  const isPrivate = q.rows[0].is_private;

  const blocked = await pool.query(
    `SELECT 1 FROM blocks
     WHERE (blocker_id = $1 AND blocked_id = $2)
        OR (blocker_id = $2 AND blocked_id = $1)
     LIMIT 1`,
    [viewerId, authorId]
  );
  if (blocked.rowCount > 0) return { ok: false, reason: "BLOCKED" };

  if (!isPrivate || viewerId === authorId) return { ok: true, authorId };

  const follows = await pool.query(
    `SELECT 1 FROM follows
     WHERE follower_id = $1 AND following_id = $2 AND status = 'accepted'
     LIMIT 1`,
    [viewerId, authorId]
  );

  return follows.rowCount > 0 ? { ok: true, authorId } : { ok: false, reason: "PRIVATE" };
}

async function postCounts(postId) {
  const q = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM likes WHERE post_id = $1)::int AS likes_count,
       (SELECT COUNT(*) FROM comments WHERE post_id = $1)::int AS comments_count`,
    [postId]
  );
  return { likesCount: q.rows[0].likes_count, commentsCount: q.rows[0].comments_count };
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return sendJson(res, 200, { ok: true });
  const url = new URL(req.url, "http://localhost");

  try {
    if (req.method === "GET" && url.pathname === "/health") {
      await pool.query("SELECT 1");
      return sendJson(res, 200, { service: "engagement-service", status: "ok" });
    }

    const likeMatch = url.pathname.match(/^\/posts\/(\d+)\/like$/);
    if (likeMatch) {
      const postId = Number(likeMatch[1]);
      const currentId = meId(req, url);

      const visibility = await canViewPost(currentId, postId);
      if (!visibility.ok) {
        if (visibility.reason === "NOT_FOUND") return sendJson(res, 404, { error: "Objava nije pronadjena" });
        return sendJson(res, 403, { error: "Nemate dozvolu za ovu akciju" });
      }

      if (req.method === "POST") {
        await pool.query(
          `INSERT INTO likes (user_id, post_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [currentId, postId]
        );
        return sendJson(res, 201, { liked: true, postId, meId: currentId, ...(await postCounts(postId)) });
      }

      if (req.method === "DELETE") {
        await pool.query(
          "DELETE FROM likes WHERE user_id = $1 AND post_id = $2",
          [currentId, postId]
        );
        return sendJson(res, 200, { liked: false, postId, meId: currentId, ...(await postCounts(postId)) });
      }
    }

    const commentsCollection = url.pathname.match(/^\/posts\/(\d+)\/comments$/);
    if (commentsCollection) {
      const postId = Number(commentsCollection[1]);
      const currentId = meId(req, url);

      const visibility = await canViewPost(currentId, postId);
      if (!visibility.ok) {
        if (visibility.reason === "NOT_FOUND") return sendJson(res, 404, { error: "Objava nije pronadjena" });
        return sendJson(res, 403, { error: "Nemate dozvolu za ovu akciju" });
      }

      if (req.method === "GET") {
        const rows = await pool.query(
          `SELECT c.id, c.post_id, c.author_id, u.username AS author_username, c.text, c.created_at, c.updated_at
           FROM comments c
           JOIN users u ON u.id = c.author_id
           WHERE c.post_id = $1
           ORDER BY c.created_at ASC`,
          [postId]
        );
        return sendJson(res, 200, { items: rows.rows });
      }

      if (req.method === "POST") {
        const body = await readBody(req);
        const text = String(body.text || "").trim();
        if (!text) return sendJson(res, 400, { error: "text je obavezan" });

        const ins = await pool.query(
          `INSERT INTO comments (post_id, author_id, text)
           VALUES ($1, $2, $3)
           RETURNING id, post_id, author_id, text, created_at, updated_at`,
          [postId, currentId, text]
        );

        return sendJson(res, 201, ins.rows[0]);
      }
    }

    const commentItem = url.pathname.match(/^\/comments\/(\d+)$/);
    if (commentItem) {
      const id = Number(commentItem[1]);
      const currentId = meId(req, url);

      const comment = await pool.query(
        "SELECT id, post_id, author_id FROM comments WHERE id = $1",
        [id]
      );
      if (comment.rowCount === 0) return sendJson(res, 404, { error: "Komentar nije pronadjen" });
      if (comment.rows[0].author_id !== currentId) return sendJson(res, 403, { error: "Samo autor menja/brise komentar" });

      if (req.method === "PATCH") {
        const body = await readBody(req);
        const text = String(body.text || "").trim();
        if (!text) return sendJson(res, 400, { error: "text je obavezan" });

        const upd = await pool.query(
          `UPDATE comments
           SET text = $2, updated_at = NOW()
           WHERE id = $1
           RETURNING id, post_id, author_id, text, created_at, updated_at`,
          [id, text]
        );
        return sendJson(res, 200, upd.rows[0]);
      }

      if (req.method === "DELETE") {
        await pool.query("DELETE FROM comments WHERE id = $1", [id]);
        return sendJson(res, 200, { deleted: true, id });
      }
    }

    return sendJson(res, 404, { error: "Ruta ne postoji" });
  } catch (err) {
    return sendJson(res, 500, { error: "Server error", detail: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`engagement-service listening on ${PORT}`);
});
