import { expect, test } from "@playwright/test";

test.describe("Landing and auth — production route smoke", () => {
  test("landing page loads for a signed-out visitor", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Đăng nhập" }).first()).toBeVisible();
  });

  test("login page renders the auth form with the terminal amber accent", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByTestId("login-form")).toBeVisible();
    // Nhãn tiếng Việt của F6 — bản trước dùng "Email"/"Password" tiếng Anh.
    await expect(page.getByLabel("TÀI KHOẢN")).toBeVisible();
    await expect(page.getByLabel("MẬT KHẨU")).toBeVisible();

    // Điểm nhấn thương hiệu đổi từ chàm `--cd-cyan #818cf8` (ClayMorphism, đã gỡ)
    // sang hổ phách `--tm-accent #FFA62B` (bàn giao §2, token accent/amber).
    const accent = await page.evaluate(() =>
      getComputedStyle(document.querySelector(".f6") ?? document.body).getPropertyValue(
        "--tm-accent"
      )
    );
    expect(accent.trim().toLowerCase()).toBe("#ffa62b");
  });

  test("register page renders the registration form", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByTestId("register-form")).toBeVisible();
  });
});
