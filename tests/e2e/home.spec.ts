import { expect, test } from "@playwright/test";

test("首页开发工具浮层不触发样式 CSP 错误", async ({ page }) => {
  const cspErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("Content Security Policy")) {
      cspErrors.push(message.text());
    }
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "把判断任务，定义为可运行的 Interface。" })).toBeVisible();
  await expect(page.locator("nextjs-portal")).toBeAttached();
  expect(cspErrors).toEqual([]);
});

test("未配置数据库时浏览 Hub 显示可操作的提示", async ({ page }) => {
  test.skip(!!process.env.DATABASE_URL || !!process.env.E2E_DATABASE_URL, "此用例只验证未配置数据库的环境");
  await page.goto("/");
  await page.getByRole("link", { name: "浏览 Hub" }).click();
  await expect(page).toHaveURL(/\/hub$/);
  await expect(page.getByRole("heading", { name: "Hub 尚未启用" })).toBeVisible();
  await expect(page.getByRole("link", { name: "打开本机 Builder" })).toHaveAttribute("href", "/builder/new");
});
