const http = require("http");
const { URL } = require("url");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { Pool } = require("pg");
const { normalizeEmail, normalizeUsername, isPasswordValid } = require("./validators");

const PORT = Number(process.env.PORT || 8081);
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const ACCESS_TOKEN_TTL_SEC = Number(process.env.ACCESS_TOKEN_TTL_SEC || 3600);
const REFRESH_TOKEN_TTL_SEC = Number(process.env.REFRESH_TOKEN_TTL_SEC || 1209600);

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

function newRefreshToken() {
  return crypto.randomBytes(48).toString("hex");
}

function accessTokenFor(user) {
  return jwt.sign({ sub: user.id, username: user.username, email: user.email }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL_SEC });
}

async function issueSession(client, user) {
  const accessToken = accessTokenFor(user);
  const refreshToken = newRefreshToken();
  await client.query(
    `INSERT INTO refresh_tokens (token, user_id, expires_at)
     VALUES ($1, $2, NOW() + ($3 || ' seconds')::interval)`,
    [refreshToken, user.id, REFRESH_TOKEN_TTL_SEC]
  );
  return { accessToken, refreshToken };
}

async function cleanupExpiredTokens() {
  await pool.query("DELETE FROM refresh_tokens WHERE expires_at < NOW()");
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return sendJson(res, 200, { ok: true });
  const url = new URL(req.url, "http://localhost");

  try {
    if (req.method === "GET" && url.pathname === "/health") {
      await pool.query("SELECT 1");
      return sendJson(res, 200, { service: "auth-service", status: "ok" });
    }

    if (req.method === "POST" && url.pathname === "/register") {
      const body = await readBody(req);
      const email = normalizeEmail(body.email);
      const username = normalizeUsername(body.username);
      const password = String(body.password || "");
      const fullName = String(body.fullName || username || "User").trim();

      if (!email || !username || !isPasswordValid(password)) {
        return sendJson(res, 400, { error: "Potrebni su email, username i lozinka od najmanje 6 karaktera" });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const exists = await client.query("SELECT 1 FROM users WHERE email = $1 OR username = $2", [email, username]);
        if (exists.rowCount > 0) {
          await client.query("ROLLBACK");
          return sendJson(res, 409, { error: "Korisnik sa tim email-om ili username-om vec postoji" });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const insertUser = await client.query(
          `INSERT INTO users (email, username, password_hash)
           VALUES ($1, $2, $3)
           RETURNING id, email, username`,
          [email, username, passwordHash]
        );
        const user = insertUser.rows[0];

        await client.query(
          `INSERT INTO profiles (user_id, full_name, bio, avatar_url, is_private)
           VALUES ($1, $2, '', '', FALSE)`,
          [user.id, fullName]
        );

        const session = await issueSession(client, user);
        await client.query("COMMIT");
        return sendJson(res, 201, { user, accessToken: session.accessToken, refreshToken: session.refreshToken });
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    }

    if (req.method === "POST" && url.pathname === "/login") {
      const body = await readBody(req);
      const login = normalizeEmail(body.login);
      const password = String(body.password || "");
      if (!login || !password) return sendJson(res, 400, { error: "Potrebni su login i password" });

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await cleanupExpiredTokens();

        const found = await client.query(
          `SELECT id, email, username, password_hash
           FROM users
           WHERE email = $1 OR username = $1`,
          [login]
        );

        if (found.rowCount === 0) {
          await client.query("ROLLBACK");
          return sendJson(res, 401, { error: "Pogresni kredencijali" });
        }

        const userRow = found.rows[0];
        const ok = await bcrypt.compare(password, userRow.password_hash);
        if (!ok) {
          await client.query("ROLLBACK");
          return sendJson(res, 401, { error: "Pogresni kredencijali" });
        }

        const user = { id: userRow.id, email: userRow.email, username: userRow.username };
        const session = await issueSession(client, user);
        await client.query("COMMIT");
        return sendJson(res, 200, { user, accessToken: session.accessToken, refreshToken: session.refreshToken });
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    }

    if (req.method === "POST" && url.pathname === "/refresh") {
      const body = await readBody(req);
      const refreshToken = String(body.refreshToken || "").trim();
      if (!refreshToken) return sendJson(res, 400, { error: "refreshToken je obavezan" });

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await cleanupExpiredTokens();

        const tok = await client.query(
          `SELECT rt.user_id, u.email, u.username
           FROM refresh_tokens rt
           JOIN users u ON u.id = rt.user_id
           WHERE rt.token = $1 AND rt.expires_at > NOW()`,
          [refreshToken]
        );

        if (tok.rowCount === 0) {
          await client.query("ROLLBACK");
          return sendJson(res, 401, { error: "Neispravan refresh token" });
        }

        await client.query("DELETE FROM refresh_tokens WHERE token = $1", [refreshToken]);

        const user = { id: tok.rows[0].user_id, email: tok.rows[0].email, username: tok.rows[0].username };
        const session = await issueSession(client, user);
        await client.query("COMMIT");
        return sendJson(res, 200, { accessToken: session.accessToken, refreshToken: session.refreshToken });
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    }

    if (req.method === "POST" && url.pathname === "/logout") {
      const body = await readBody(req);
      const refreshToken = String(body.refreshToken || "").trim();
      if (!refreshToken) return sendJson(res, 400, { error: "refreshToken je obavezan" });
      await pool.query("DELETE FROM refresh_tokens WHERE token = $1", [refreshToken]);
      return sendJson(res, 200, { message: "Odjavljen" });
    }

    return sendJson(res, 404, { error: "Ruta ne postoji" });
  } catch (err) {
    return sendJson(res, 500, { error: "Server error", detail: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`auth-service listening on ${PORT}`);
});
