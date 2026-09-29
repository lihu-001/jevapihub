import { expect, test } from "@playwright/test";
import { manifest } from "../fixture";

test("游客可浏览登录页，但云端操作需要登录", async ({ page }) => {
  await page.goto("/me/interfaces");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "登录后保存你的 Interface" })).toBeVisible();
  const response = await page.request.post("/api/interfaces", { data: { manifest } });
  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toBe("no-store");
  const aiResponse = await page.request.post("/api/ai-builder/generate", { data: { prompt: "Create a content scoring Interface" } });
  expect(aiResponse.status()).toBe(401);
  await page.goto("/builder/new");
  await expect(page.getByRole("button", { name: "AI Builder" })).toHaveCount(0);
  const sampleId = "00000000-0000-4000-8000-000000000000";
  expect((await page.request.put(`/api/admin/interfaces/${sampleId}/hidden`, { data: { hidden: true } })).status()).toBe(401);
});

test("系统暗色偏好切换基础设计变量", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const dark = await page.locator("html").evaluate((element) => getComputedStyle(element).backgroundColor);
  await page.emulateMedia({ colorScheme: "light" });
  const light = await page.locator("html").evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(dark).not.toBe(light);
});
