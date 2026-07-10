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
      name: "chromium-landing-auth",
      testMatch: /landing-auth\.spec\.ts$/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
      },
    },
    {
      name: "chromium-dashboard-smoke",
      testMatch: /dashboard-command-deck\.spec\.ts$/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
        storageState: authState,
      },
    },
    {
      name: "chromium-setups-smoke",
      testMatch: /setups-workstation\.spec\.ts$/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
        storageState: authState,
      },
    },
    {
      name: "chromium-paper-lab-arena",
      testMatch: /paper-lab-arena\.spec\.ts$/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
        storageState: authState,
      },
    },
    {
      name: "chromium-responsive-authenticated",
      testMatch: /responsive-authenticated\.spec\.ts$/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: authState,
      },
    },
    {
      name: "chromium-responsive-public",
      testMatch: /responsive-public\.spec\.ts$/,
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "chromium-a11y-authenticated",
      testMatch: /accessibility-authenticated\.spec\.ts$/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
        storageState: authState,
      },
    },
    {
      name: "chromium-a11y-public",
      testMatch: /accessibility-public\.spec\.ts$/,
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
