const { test, expect } = require("@playwright/test");

test("register/login UI flow", async ({ page }) => {
  await page.goto("/");

  const uid = Date.now();
  await page.fill("#regEmail", `ui_${uid}@example.com`);
  await page.fill("#regUsername", `ui_${uid}`);
  await page.fill("#regFullName", "UI Tester");
  await page.fill("#regPassword", "123456");
  await page.click("#btnRegister");

  await expect(page.locator("#sessionInfo")).toContainText("userId=");

  await page.fill("#searchInput", "ana");
  await page.click("#btnSearch");
  await expect(page.locator("#searchResults .card").first()).toBeVisible();

  await page.fill("#postCaption", "UI post");
  await page.fill("#postMediaUrl", "https://example.com/ui.jpg");
  await page.fill("#postMediaType", "image");
  await page.fill("#postMediaSize", "1.1");
  await page.click("#btnCreatePost");
  await expect(page.locator("#createPostInfo")).toContainText("Objava kreirana");
});
