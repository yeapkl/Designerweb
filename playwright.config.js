// @ts-check
const { defineConfig, devices } = require("@playwright/test");

// Tests run against a live server: by default the Docker image started
// locally (`docker run -p 8080:8080 imili-web`), or any deployed URL via
// BASE_URL=https://... npm test
module.exports = defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  fullyParallel: true,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:8080",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
