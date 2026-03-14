const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/ui",
  timeout: 60000,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry"
  }
});
