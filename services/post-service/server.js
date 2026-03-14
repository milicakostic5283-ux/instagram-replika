const http = require("http");
const { URL } = require("url");
const { Pool } = require("pg");
const { toBytes, validateMediaItems } = require("./validation");

const PORT = Number(process.env.PORT || 8084);

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
    req.on("data", (chunk) => { body += chunk; });
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

async function canViewAuthor(viewerId, authorId) {
  const blocked = await pool.query(
    `SELECT 1 FROM blocks
     WHERE (blocker_id = $1 AND blocked_id = $2)
        OR (blocker_id = $2 AND blocked_id = $1)
     LIMIT 1`,
    [viewerId, authorId]
  );
  if (blocked.rowCount > 0) return false;

  const p = await pool.query("SELECT is_private FROM profiles WHERE user_id = $1", [authorId]);
  if (p.rowCount === 0) return false;
  if (!p.rows[0].is_private) return true;
  if (viewerId === authorId) return true;

  const f = await pool.query(
    `SELECT 1 FROM follows
     WHERE follower_id = $1 AND following_id = $2 AND status = 'accepted'
     LIMIT 1`,
    [viewerId, authorId]
  );
  return f.rowCount > 0;
}

async function loadPost(postId) {
  const p = await pool.query(`SELECT id, author_id, caption, created_at, updated_at FROM posts WHERE id = $1`, [postId]);
  if (p.rowCount === 0) return null;

  const media = await pool.query(
    `SELECT id, media_type, media_url, size_bytes, position
     FROM post_media
     WHERE post_id = $1
     ORDER BY position ASC`,
    [postId]
  );

  const counts = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM likes WHERE post_id = $1)::int AS likes_count,
       (SELECT COUNT(*) FROM comments WHERE post_id = $1)::int AS comments_count`,
    [postId]
  );

  return {
    id: p.rows[0].id,
    authorId: p.rows[0].author_id,
    caption: p.rows[0].caption,
    createdAt: p.rows[0].created_at,
    updatedAt: p.rows[0].updated_at,
    media: media.rows,
    likesCount: counts.rows[0].likes_count,
    commentsCount: counts.rows[0].comments_count
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return sendJson(res, 200, { ok: true });
  const url = new URL(req.url, "http://localhost");

  try {
    if (req.method === "GET" && url.pathname === "/health") {
      await pool.query("SELECT 1");
      return sendJson(res, 200, { service: "post-service", status: "ok" });
    }

    if ((req.method === "POST") && (url.pathname === "/" || url.pathname === "/posts")) {
      const body = await readBody(req);
      const currentId = meId(req, url);
      const media = Array.isArray(body.media) ? body.media : [];
      const mediaCheck = validateMediaItems(media);
      if (!mediaCheck.ok) return sendJson(res, 400, { error: mediaCheck.error });

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const insPost = await client.query(
          `INSERT INTO posts (author_id, caption)
           VALUES ($1, $2)
           RETURNING id`,
          [currentId, String(body.caption || "")]
        );
        const postId = insPost.rows[0].id;

        for (let i = 0; i < media.length; i += 1) {
          const item = media[i];
          const type = String(item.type || item.mediaType).toLowerCase();
          const urlValue = String(item.url || item.mediaUrl || "").trim() || `mock://media/${postId}/${i}`;
          const sizeBytes = toBytes(item.sizeMb || 0);
          await client.query(
            `INSERT INTO post_media (post_id, media_type, media_url, size_bytes, position)
             VALUES ($1, $2, $3, $4, $5)`,
            [postId, type, urlValue, sizeBytes, i]
          );
        }

        await client.query("COMMIT");
        const full = await loadPost(postId);
        return sendJson(res, 201, full);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    }

    if ((req.method === "GET") && (url.pathname === "/" || url.pathname === "/posts")) {
      const viewerId = meId(req, url);
      const authorId = Number(url.searchParams.get("authorId") || 0);

      let rows;
      if (authorId > 0) {
        rows = await pool.query("SELECT id, author_id, caption, created_at, updated_at FROM posts WHERE author_id = $1 ORDER BY created_at DESC LIMIT 50", [authorId]);
      } else {
        rows = await pool.query("SELECT id, author_id, caption, created_at, updated_at FROM posts ORDER BY created_at DESC LIMIT 50");
      }

      const items = [];
      for (const row of rows.rows) {
        if (await canViewAuthor(viewerId, row.author_id)) {
          const post = await loadPost(row.id);
          if (post) items.push(post);
        }
      }
      return sendJson(res, 200, { items });
    }

    const postMatch = url.pathname.match(/^\/(?:posts\/)?(\d+)$/);
    if (postMatch) {
      const postId = Number(postMatch[1]);
      const viewerId = meId(req, url);
      const post = await loadPost(postId);

      if (!post) return sendJson(res, 404, { error: "Objava nije pronadjena" });
      if (!(await canViewAuthor(viewerId, post.authorId))) return sendJson(res, 403, { error: "Nemate pristup ovoj objavi" });

      if (req.method === "GET") return sendJson(res, 200, post);

      if (req.method === "PATCH") {
        if (post.authorId !== viewerId) return sendJson(res, 403, { error: "Samo autor menja objavu" });
        const body = await readBody(req);
        await pool.query("UPDATE posts SET caption = $2, updated_at = NOW() WHERE id = $1", [postId, String(body.caption || "")]);
        const updated = await loadPost(postId);
        return sendJson(res, 200, updated);
      }

      if (req.method === "DELETE") {
        if (post.authorId !== viewerId) return sendJson(res, 403, { error: "Samo autor brise objavu" });
        await pool.query("DELETE FROM posts WHERE id = $1", [postId]);
        return sendJson(res, 200, { deleted: true, postId });
      }
    }

    const mediaMatch = url.pathname.match(/^\/(?:posts\/)?(\d+)\/media\/(\d+)$/);
    if (mediaMatch && req.method === "DELETE") {
      const postId = Number(mediaMatch[1]);
      const mediaId = Number(mediaMatch[2]);
      const viewerId = meId(req, url);

      const owner = await pool.query("SELECT author_id FROM posts WHERE id = $1", [postId]);
      if (owner.rowCount === 0) return sendJson(res, 404, { error: "Objava nije pronadjena" });
      if (owner.rows[0].author_id !== viewerId) return sendJson(res, 403, { error: "Samo autor menja mediju" });

      const deleted = await pool.query("DELETE FROM post_media WHERE post_id = $1 AND id = $2 RETURNING id", [postId, mediaId]);
      if (deleted.rowCount === 0) return sendJson(res, 404, { error: "Media nije pronadjena" });

      await pool.query("UPDATE posts SET updated_at = NOW() WHERE id = $1", [postId]);
      const updated = await loadPost(postId);
      return sendJson(res, 200, updated);
    }

    return sendJson(res, 404, { error: "Ruta ne postoji" });
  } catch (err) {
    return sendJson(res, 500, { error: "Server error", detail: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`post-service listening on ${PORT}`);
});
