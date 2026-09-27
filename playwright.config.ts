import { defineConfig, devices } from "@playwright/test";

const liveDatabase = process.env.E2E_DATABASE_URL;
const liveAuthSecret = process.env.E2E_AUTH_SECRET || "jev-e2e-test-session-secret-never-use-in-production";

export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: "http://localhost:3217", trace: "on-first-retry" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["iPhone 13"], browserName: "chromium" } },
  ],
  webServer: { command: "npm run dev -- -p 3217", url: "http://localhost:3217", reuseExistingServer: !process.env.CI && !liveDatabase,
    timeout: 120_000, env: liveDatabase ? { DATABASE_URL: liveDatabase, AUTH_SECRET: liveAuthSecret, NEXTAUTH_URL: "http://localhost:3217" } : undefined },
});
