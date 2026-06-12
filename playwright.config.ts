import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const authState = path.join(process.cwd(), "playwright", ".auth", "user.json");

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  timeout: 60_000,
  globalSetup: path.join(process.cwd(), "tests", "playwright", "global-setup.ts"),
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    screenshot: "only-on-failure",
    trace: "off",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium-trades-layout-wide",
      testMatch: /trades-table-layout\.spec\.ts$/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1365, height: 900 },
        storageState: authState,
      },
    },
    {
      name: "chromium-trades-layout-narrow",
      testMatch: /trades-table-layout\.spec\.ts$/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 900, height: 800 },
        storageState: authState,
      },
    },
    {
      name: "chromium-trades-workstation",
      testMatch: /trades-workstation\.spec\.ts$/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
        storageState: authState,
      },
    },
    {
      name: "chromium-dashboard-smoke",
      testMatch: /dashboard-cyber-cockpit\.spec\.ts$/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
