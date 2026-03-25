const http = require("http");
const { spawn } = require("child_process");
const path = require("path");

function check(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitFor(url, tries = 30) {
  for (let i = 0; i < tries; i += 1) {
    if (await check(url)) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function main() {
  let apiBase = process.env.API_BASE_URL;
  let mockProc = null;

  if (!apiBase) {
    if (await check("http://localhost:8080/health")) {
      apiBase = "http://localhost:8080";
    } else if (await check("http://localhost:8081/health")) {
      apiBase = "http://localhost:8081";
    } else {
      mockProc = spawn("node", ["quickstart/mock-api.js"], {
        cwd: process.cwd(),
        stdio: "ignore",
        windowsHide: true
      });
      const ready = await waitFor("http://localhost:8081/health");
      if (!ready) {
        if (mockProc) mockProc.kill();
        throw new Error("Mock API nije startovao na vreme.");
      }
      apiBase = "http://localhost:8081";
    }
  }

  const jestBin = path.join(process.cwd(), "node_modules", "jest", "bin", "jest.js");
  const jestArgs = ["--config", "jest.config.cjs", "--runInBand", "--coverage=false", "tests/api"];

  const code = await new Promise((resolve, reject) => {
    const child = spawn("node", [jestBin, ...jestArgs], {
      cwd: process.cwd(),
      stdio: "inherit",
      env: { ...process.env, API_BASE_URL: apiBase },
      windowsHide: true
    });
    child.on("exit", resolve);
    child.on("error", reject);
  });

  if (mockProc) mockProc.kill();
  process.exit(code ?? 1);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
