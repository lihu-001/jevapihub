import { expect, test } from "@playwright/test";
import { manifest } from "../fixture";

test("游客可浏览登录页，但云端操作需要登录", async ({ page }) => {
  await page.goto("/me/interfaces");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "登录后保存你的 Interface" })).toBeVisible();
  const response = await page.request.post("/api/interfaces", { data: { manifest } });
  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toBe("no-store");
});
