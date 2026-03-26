const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/ui",
  timeout: 60000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  fullyParallel: false,
  webServer: [
    {
      command: "node quickstart/mock-api.js",
      url: "http://localhost:8081/health",
      cwd: ".",
      reuseExistingServer: true
    },
    {
      command: "node server.js",
      url: "http://localhost:3000",
      cwd: "./services/frontend-service",
      reuseExistingServer: true
    }
  ],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry"
  }
});
