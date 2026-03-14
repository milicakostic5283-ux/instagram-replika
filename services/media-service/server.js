const http = require("http");
const { URL } = require("url");
const crypto = require("crypto");
const { Pool } = require("pg");

const PORT = Number(process.env.PORT || 8087);

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

function toBytes(sizeMb) {
  return Math.round(Number(sizeMb || 0) * 1024 * 1024);
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return sendJson(res, 200, { ok: true });
  const url = new URL(req.url, "http://localhost");

  try {
    if (req.method === "GET" && url.pathname === "/health") {
      await pool.query("SELECT 1");
      return sendJson(res, 200, { service: "media-service", status: "ok" });
    }

    if (req.method === "POST" && url.pathname === "/upload") {
      const body = await readBody(req);
      const currentId = meId(req, url);
      const mediaType = String(body.type || body.mediaType || "").toLowerCase();
      const originalName = String(body.originalName || "media.bin");
      const sizeBytes = toBytes(body.sizeMb || 0);

      if (!["image", "video"].includes(mediaType)) {
        return sendJson(res, 400, { error: "Dozvoljeni su samo image/video" });
      }
      if (sizeBytes <= 0 || sizeBytes > 52428800) {
        return sendJson(res, 400, { error: "Maksimalna velicina fajla je 50MB" });
      }

      const mediaUrl = `https://minio.local/mock/${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
      const ins = await pool.query(
        `INSERT INTO media_uploads (uploader_id, media_type, original_name, size_bytes, media_url)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, uploader_id, media_type, original_name, size_bytes, media_url, created_at`,
        [currentId, mediaType, originalName, sizeBytes, mediaUrl]
      );
      return sendJson(res, 201, ins.rows[0]);
    }

    if (req.method === "GET" && url.pathname === "/uploads") {
      const currentId = meId(req, url);
      const q = await pool.query(
        `SELECT id, uploader_id, media_type, original_name, size_bytes, media_url, created_at
         FROM media_uploads
         WHERE uploader_id = $1
         ORDER BY created_at DESC
         LIMIT 100`,
        [currentId]
      );
      return sendJson(res, 200, { items: q.rows });
    }

    return sendJson(res, 404, { error: "Ruta ne postoji" });
  } catch (err) {
    return sendJson(res, 500, { error: "Server error", detail: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`media-service listening on ${PORT}`);
});
