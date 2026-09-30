import { randomUUID } from "node:crypto";
import { expect, test, type Browser, type BrowserContext } from "@playwright/test";
import { encode } from "next-auth/jwt";
import pg from "pg";

const DATABASE_URL = process.env.E2E_DATABASE_URL;
const AUTH_SECRET = process.env.E2E_AUTH_SECRET || "jev-e2e-test-session-secret-never-use-in-production";
test.skip(!DATABASE_URL, "需要独立的 E2E_DATABASE_URL 测试库；先运行 db:migrate");

async function signedContext(browser: Browser, userId: string, name: string): Promise<BrowserContext> {
  const context = await browser.newContext({ baseURL: "http://localhost:3217" });
  const token = await encode({ token: { userId, sub: userId, name, email: `${userId}@example.invalid` }, secret: AUTH_SECRET, maxAge: 3600 });
  await context.addCookies([{ name: "next-auth.session-token", value: token, url: "http://localhost:3217", httpOnly: true, sameSite: "Lax" }]);
  return context;
}

test("管理员发布 v1/v2，游客和普通用户只可查看运行 Hub", async ({ browser }) => {
  if (!DATABASE_URL) return;
  const database = new pg.Client({ connectionString: DATABASE_URL });
  await database.connect();
  let authorId: string;
  let readerId: string;
  try {
    const nonce = randomUUID();
    const author = await database.query<{ id: string }>("INSERT INTO users(name, email, role) VALUES ($1, $2, 'admin') RETURNING id", ["E2E Author", `e2e-author-${nonce}@example.invalid`]);
    const reader = await database.query<{ id: string }>("INSERT INTO users(name, email) VALUES ($1, $2) RETURNING id", ["E2E Reader", `e2e-reader-${nonce}@example.invalid`]);
    authorId = author.rows[0].id;
    readerId = reader.rows[0].id;
  } finally { await database.end(); }

  const authorContext = await signedContext(browser, authorId, "E2E Author");
  const readerContext = await signedContext(browser, readerId, "E2E Reader");
  const guestContext = await browser.newContext({ baseURL: "http://localhost:3217" });
  try {
    const authorPage = await authorContext.newPage();
    await authorPage.goto("/builder/new");
    await expect(authorPage.getByRole("button", { name: "保存到云端" })).toBeVisible();
    await authorPage.getByRole("textbox", { name: "State 内容" }).fill("guest content");
    await authorPage.getByRole("button", { name: "保存到云端" }).click();
    const dialog = authorPage.getByRole("dialog");
    await expect(dialog.getByRole("textbox", { name: "标题（必填）" })).toBeEmpty();
    await dialog.getByRole("button", { name: "确认保存" }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("textbox", { name: "标题（必填）" }).fill("E2E Published Interface");
    await dialog.getByRole("textbox", { name: "描述（选填）" }).fill("E2E description");
    const createdResponse = authorPage.waitForResponse((response) => response.url().endsWith("/api/interfaces") && response.request().method() === "POST");
    await dialog.getByRole("button", { name: "确认保存" }).click();
    const created = await (await createdResponse).json();
    expect(created).toHaveProperty("interface.id");
    const interfaceId = created.interface.id as string;
    await expect(authorPage).toHaveURL(new RegExp(`/builder/${interfaceId}$`));
    await expect(dialog).not.toBeVisible();
    const draft = await authorContext.request.get(`/api/interfaces/${interfaceId}`);
    await expect(await draft.json()).toMatchObject({ interface: { name: "E2E Published Interface", description: "E2E description" } });
    await authorPage.getByRole("button", { name: "发布版本" }).click();
    await expect(authorPage.getByRole("heading", { name: "Hub 试运行预览" })).toBeVisible();
    await expect(authorPage.getByRole("textbox", { name: /待分析内容/ })).toHaveValue("guest content");
    await authorPage.getByRole("combobox", { name: "可见性" }).selectOption("public");
    await authorPage.getByRole("button", { name: "确认发布" }).click();
    await expect(authorPage.locator(".status-line")).toContainText("已发布 v1");
    const versionsV1 = await authorContext.request.get(`/api/interfaces/${interfaceId}/versions`);
    const firstVersion = ((await versionsV1.json()) as { versions: { id: string; versionNumber: number }[] }).versions[0];
    expect(firstVersion.versionNumber).toBe(1);

    if ((authorPage.viewportSize()?.width ?? 1200) < 900) await authorPage.getByRole("button", { name: "Questions", exact: true }).click();
    await authorPage.getByRole("textbox", { name: "is_urgent JSON" }).fill(JSON.stringify({ type: "noul", instructions: "Published v2 instruction" }, null, 2));
    await authorPage.getByRole("button", { name: "发布版本" }).click();
    await authorPage.getByRole("button", { name: "确认发布" }).click();
    await expect(authorPage.locator(".status-line")).toContainText("已发布 v2");
    const versionsV2 = await authorContext.request.get(`/api/interfaces/${interfaceId}/versions`);
    const secondVersion = ((await versionsV2.json()) as { versions: { id: string; versionNumber: number }[] }).versions[0];
    expect(secondVersion.versionNumber).toBe(2);
    const original = await authorContext.request.get(`/api/interfaces/${interfaceId}/versions/${firstVersion.id}`);
    const originalBody = await original.json() as { version: { manifestJson: { questions: { is_urgent: { instructions: string } } } } };
    expect(originalBody.version.manifestJson.questions.is_urgent.instructions).not.toBe("Published v2 instruction");

    const guestPage = await guestContext.newPage();
    await guestPage.route(`**/api/runtime/interfaces/${interfaceId}/versions/${secondVersion.id}`, async (route) => {
      expect(route.request().headers()["x-typesafe-api-key"]).toBe("E2E_TEST_TYPESAFE_KEY");
      expect(route.request().postDataJSON()).toEqual({ inputs: { content: "访客自己的内容" } });
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ result: {
        model: "jev-1.13.0", answers: {
          department: { type: "choice", choice: "支付", probabilities: { "支付": 0.8, "技术": 0.1, "销售": 0.1 }, confidence: 0.8 },
          frustration: { type: "score", score: 1, legend: { "0": "情绪平静，仅陈述事实", "1": "感到沮丧但态度客气", "2": "非常愤怒，言辞激烈" }, probabilities: { "0": 0.2, "1": 0.7, "2": 0.1 }, confidence: 0.7 },
          is_urgent: { type: "noul", noul: 0.8 },
        }, usage: { input_tokens: 1, output_tokens: 1 },
      }, metrics: [] }) });
    });
    const published = await authorContext.request.get(`/api/interfaces/${interfaceId}`);
    const { interface: { slug } } = await published.json() as { interface: { slug: string } };
    await guestPage.goto(`/i/${authorId}/${slug}`);
    await expect(guestPage.getByRole("heading", { name: "E2E Published Interface" })).toBeVisible();
    await expect(guestPage.getByRole("textbox", { name: /待分析内容/ })).toHaveValue("guest content");
    await guestPage.getByRole("textbox", { name: /待分析内容/ }).fill("访客自己的内容");
    await guestPage.getByRole("button", { name: "设置 API Key" }).click();
    await guestPage.getByLabel("你的 API Key").fill("E2E_TEST_TYPESAFE_KEY");
    await guestPage.getByRole("button", { name: "完成" }).click();
    await guestPage.getByRole("button", { name: "运行", exact: true }).click();
    await expect(guestPage.getByText("0.800")).toBeVisible();
    await guestPage.reload();
    await expect(guestPage.getByRole("button", { name: "设置 API Key" })).toBeVisible();

    const readerPage = await readerContext.newPage();
    await readerPage.goto(`/i/${authorId}/${slug}`);
    await expect(readerPage.getByRole("heading", { name: "E2E Published Interface" })).toBeVisible();
    await readerPage.goto("/builder/new");
    await expect(readerPage.getByRole("button", { name: "保存到云端" })).toBeVisible();
    await expect(readerPage.getByRole("button", { name: "发布版本" })).toHaveCount(0);
    const denied = await readerContext.request.post(`/api/interfaces/${interfaceId}/publish`, { data: { visibility: "public" } });
    expect(denied.status()).toBe(403);
  } finally {
    await authorContext.close(); await readerContext.close(); await guestContext.close();
  }
});
