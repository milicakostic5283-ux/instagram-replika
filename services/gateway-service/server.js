const http = require("http");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 8080);
const TARGETS = {
  "/api/auth": process.env.AUTH_URL || "http://localhost:8081",
  "/api/users": process.env.USER_URL || "http://localhost:8082",
  "/api/social": process.env.SOCIAL_URL || "http://localhost:8083",
  "/api/posts": process.env.POST_URL || "http://localhost:8084",
  "/api/engagement": process.env.ENGAGEMENT_URL || "http://localhost:8085",
  "/api/feed": process.env.FEED_URL || "http://localhost:8086",
  "/api/media": process.env.MEDIA_URL || "http://localhost:8087"
};

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Id"
  });
  res.end(JSON.stringify(data));
}

function resolveTarget(pathname) {
  for (const prefix of Object.keys(TARGETS)) {
    if (pathname.startsWith(prefix)) return { prefix, target: TARGETS[prefix] };
  }
  return null;
}

function proxy(req, res, targetBase, stripPrefix) {
  const incoming = new URL(req.url, "http://localhost");
  const downstreamPath = incoming.pathname.replace(stripPrefix, "") || "/";
  const target = new URL(targetBase + downstreamPath + incoming.search);

  const options = {
    method: req.method,
    hostname: target.hostname,
    port: target.port,
    path: target.pathname + target.search,
    headers: {
      ...req.headers,
      host: target.host
    }
  };

  const pReq = http.request(options, (pRes) => {
    res.writeHead(pRes.statusCode || 500, {
      ...pRes.headers,
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Id"
    });
    pRes.pipe(res);
  });

  pReq.on("error", () => {
    sendJson(res, 502, { error: "Downstream servis nije dostupan" });
  });

  req.pipe(pReq);
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") return sendJson(res, 200, { ok: true });

  const url = new URL(req.url, "http://localhost");
  if (req.method === "GET" && url.pathname === "/health") {
    return sendJson(res, 200, { service: "gateway-service", status: "ok" });
  }

  const match = resolveTarget(url.pathname);
  if (!match) return sendJson(res, 404, { error: "Ruta ne postoji" });

  proxy(req, res, match.target, match.prefix);
});

server.listen(PORT, () => {
  console.log(`gateway-service listening on ${PORT}`);
});
