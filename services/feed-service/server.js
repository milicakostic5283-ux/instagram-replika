const http = require("http");
const { URL } = require("url");
const { Pool } = require("pg");

const PORT = Number(process.env.PORT || 8086);

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

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return sendJson(res, 200, { ok: true });
  const url = new URL(req.url, "http://localhost");

  try {
    if (req.method === "GET" && url.pathname === "/health") {
      await pool.query("SELECT 1");
      return sendJson(res, 200, { service: "feed-service", status: "ok" });
    }

    if (req.method === "GET" && (url.pathname === "/feed" || url.pathname === "/")) {
      const currentId = meId(req, url);
      const limit = Number(url.searchParams.get("limit") || 100);

      const q = await pool.query(
        `SELECT p.id AS post_id,
                p.author_id,
                u.username AS author_username,
                p.caption,
                p.created_at,
                p.updated_at,
                COALESCE((SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id), 0)::int AS likes_count,
                COALESCE((SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id), 0)::int AS comments_count
         FROM posts p
         JOIN users u ON u.id = p.author_id
         JOIN follows f ON f.following_id = p.author_id
                      AND f.follower_id = $1
                      AND f.status = 'accepted'
         WHERE NOT EXISTS (
           SELECT 1 FROM blocks b
           WHERE (b.blocker_id = $1 AND b.blocked_id = p.author_id)
              OR (b.blocker_id = p.author_id AND b.blocked_id = $1)
         )
         ORDER BY p.created_at DESC
         LIMIT $2`,
        [currentId, limit]
      );

      const items = [];
      for (const row of q.rows) {
        const media = await pool.query(
          `SELECT id, media_type, media_url, size_bytes, position
           FROM post_media
           WHERE post_id = $1
           ORDER BY position ASC`,
          [row.post_id]
        );
        items.push({
          isEdited: row.updated_at !== row.created_at,
          postId: row.post_id,
          authorId: row.author_id,
          authorUsername: row.author_username,
          caption: row.caption,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          likesCount: row.likes_count,
          commentsCount: row.comments_count,
          media: media.rows
        });
      }

      return sendJson(res, 200, { items });
    }

    return sendJson(res, 404, { error: "Ruta ne postoji" });
  } catch (err) {
    return sendJson(res, 500, { error: "Server error", detail: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`feed-service listening on ${PORT}`);
});
