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

test("登录用户发布 v1/v2，访客试运行公共版本，第二位用户 Fork", async ({ browser }) => {
  if (!DATABASE_URL) return;
  const database = new pg.Client({ connectionString: DATABASE_URL });
  await database.connect();
  let authorId: string;
  let readerId: string;
  try {
    const nonce = randomUUID();
    const author = await database.query<{ id: string }>("INSERT INTO users(name, email) VALUES ($1, $2) RETURNING id", ["E2E Author", `e2e-author-${nonce}@example.invalid`]);
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
    await authorPage.getByRole("textbox", { name: "Interface 名称" }).fill("E2E Published Interface");
    const createdResponse = authorPage.waitForResponse((response) => response.url().endsWith("/api/interfaces") && response.request().method() === "POST");
    await authorPage.getByRole("button", { name: "保存到云端" }).click();
    const created = await (await createdResponse).json() as { interface: { id: string } };
    const interfaceId = created.interface.id;
    await expect(authorPage).toHaveURL(new RegExp(`/builder/${interfaceId}$`));
    await authorPage.getByRole("button", { name: "发布版本" }).click();
    await authorPage.getByRole("combobox", { name: "可见性" }).selectOption("public");
    await authorPage.getByRole("button", { name: "确认发布" }).click();
    await expect(authorPage.locator(".status-line")).toContainText("已发布 v1");
    const versionsV1 = await authorContext.request.get(`/api/interfaces/${interfaceId}/versions`);
    const firstVersion = ((await versionsV1.json()) as { versions: { id: string; versionNumber: number }[] }).versions[0];
    expect(firstVersion.versionNumber).toBe(1);

    await authorPage.getByRole("button", { name: "Raw Manifest" }).click();
    const editor = authorPage.getByRole("textbox", { name: "完整 Manifest JSON" });
    const draft = JSON.parse(await editor.inputValue()) as { questions: { assessment: { instructions: string } } };
    draft.questions.assessment.instructions = "Published v2 instruction";
    await editor.fill(JSON.stringify(draft));
    await authorPage.getByRole("button", { name: "应用 Manifest" }).click();
    await authorPage.getByRole("button", { name: "发布版本" }).click();
    await authorPage.getByRole("button", { name: "确认发布" }).click();
    await expect(authorPage.locator(".status-line")).toContainText("已发布 v2");
    const versionsV2 = await authorContext.request.get(`/api/interfaces/${interfaceId}/versions`);
    const secondVersion = ((await versionsV2.json()) as { versions: { id: string; versionNumber: number }[] }).versions[0];
    expect(secondVersion.versionNumber).toBe(2);
    const original = await authorContext.request.get(`/api/interfaces/${interfaceId}/versions/${firstVersion.id}`);
    const originalBody = await original.json() as { version: { manifestJson: { questions: { assessment: { instructions: string } } } } };
    expect(originalBody.version.manifestJson.questions.assessment.instructions).not.toBe("Published v2 instruction");

    const guestPage = await guestContext.newPage();
    await guestPage.route(`**/api/runtime/interfaces/${interfaceId}/versions/${secondVersion.id}`, async (route) => {
      expect(route.request().headers()["x-typesafe-api-key"]).toBe("E2E_TEST_TYPESAFE_KEY");
      expect(route.request().postDataJSON()).toEqual({ inputs: { content: "guest content" } });
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ result: {
        model: "jev-1.13.0", answers: { assessment: { type: "noul", noul: 0.8 } }, usage: { input_tokens: 1, output_tokens: 1 },
      }, metrics: [] }) });
    });
    await guestPage.goto(`/i/${authorId}/new-interface`);
    await expect(guestPage.getByRole("heading", { name: "E2E Published Interface" })).toBeVisible();
    await guestPage.getByRole("button", { name: "设置 API Key" }).click();
    await guestPage.getByLabel("你的 API Key").fill("E2E_TEST_TYPESAFE_KEY");
    await guestPage.getByRole("button", { name: "完成" }).click();
    await guestPage.getByLabel("待分析内容 *").fill("guest content");
    await guestPage.getByRole("button", { name: "运行 Interface" }).click();
    await expect(guestPage.getByText("0.800")).toBeVisible();
    await guestPage.reload();
    await expect(guestPage.getByRole("button", { name: "设置 API Key" })).toBeVisible();

    const readerPage = await readerContext.newPage();
    await readerPage.goto(`/i/${authorId}/new-interface`);
    await readerPage.getByRole("button", { name: "Fork 到我的 Draft" }).click();
    await expect(readerPage).toHaveURL(/\/builder\/[0-9a-f-]+$/);
    const forkId = new URL(readerPage.url()).pathname.split("/").pop()!;
    const forkResponse = await readerContext.request.get(`/api/interfaces/${forkId}`);
    const fork = await forkResponse.json() as { interface: { ownerId: string; forkedFromInterfaceId: string; forkedFromVersionId: string }; manifest: unknown };
    expect(fork.interface).toMatchObject({ ownerId: readerId, forkedFromInterfaceId: interfaceId, forkedFromVersionId: secondVersion.id });
    expect(fork.manifest).toBeTruthy();
    const source = await authorContext.request.get(`/api/interfaces/${interfaceId}/versions/${secondVersion.id}`);
    expect((await source.json() as { version: { manifestJson: { questions: { assessment: { instructions: string } } } } }).version.manifestJson.questions.assessment.instructions).toBe("Published v2 instruction");
  } finally {
    await authorContext.close(); await readerContext.close(); await guestContext.close();
  }
});
