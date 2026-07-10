import { expect, test } from "@playwright/test";

test.describe("Landing and auth — production route smoke", () => {
  test("landing page loads for a signed-out visitor", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" }).first()).toBeVisible();
  });

  test("login page renders the auth form with the approved indigo accent", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByTestId("login-form")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();

    const accent = await page.evaluate(() =>
      getComputedStyle(document.querySelector(".cd-auth") ?? document.body).getPropertyValue(
        "--cd-cyan"
      )
    );
    expect(accent.trim().toLowerCase()).toBe("#818cf8");
  });

  test("register page renders the registration form", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByTestId("register-form")).toBeVisible();
  });
});
