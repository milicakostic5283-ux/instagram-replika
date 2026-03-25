const { test, expect } = require("@playwright/test");

test("register/login UI flow", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#apiBaseLabel")).toContainText("8081");
  await expect(page.locator("#sessionInfo")).toContainText("Nisi ulogovan.");

  await page.fill("#loginValue", "milica@example.com");
  await page.fill("#loginPassword", "123456");
  await page.click("#btnLogin");

  await expect(page.locator("#sessionInfo")).toContainText("Ulogovan si kao");

  await page.fill("#searchInput", "natalija");
  await page.click("#btnSearch");
  await expect(page.locator("#searchResults .search-user-card").first()).toContainText("@natalija");

  await page.fill("#postCaption", "UI post");
  await page.fill("#postMediaUrl", "https://example.com/ui.jpg");
  await page.fill("#postMediaType", "image");
  await page.fill("#postMediaSize", "1.1");
  await page.click("#btnCreatePost");
  await expect(page.locator("#createPostInfo")).toContainText("Objava je kreirana");
});
