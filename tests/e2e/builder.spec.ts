import { expect, test } from "@playwright/test";
import { manifest, providerResponse } from "../fixture";

test("游客创建、运行、导出 Manifest；未勾选时刷新清除 Key", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/runtime/playground", async (route) => {
    const request = route.request();
    expect(request.headers()["x-typesafe-api-key"]).toBe("TEST_SECRET_TYPESAFE_KEY_DO_NOT_STORE_123456");
    const body = request.postDataJSON() as { manifest: unknown; inputs: unknown };
    expect(JSON.stringify(body)).not.toContain("TEST_SECRET_TYPESAFE_KEY_DO_NOT_STORE_123456");
    expect(body.inputs).toEqual({ content: "测试内容" });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ result: {
      ...providerResponse,
      answers: { assessment: { type: "noul", noul: 0.83 } },
    }, metrics: [] }) });
  });
  const navigation = await page.goto("/builder/new");
  expect(navigation?.headers()["content-security-policy"]).toContain("script-src 'self' 'nonce-");
  expect(navigation?.headers()["content-security-policy"]).not.toContain("'unsafe-inline'");
  await expect(page.getByRole("heading", { name: "Inputs / State" })).toBeVisible();
  await page.getByRole("button", { name: "TypeSafe · 未设置" }).click();
  await page.getByLabel("你的 API Key").fill("TEST_SECRET_TYPESAFE_KEY_DO_NOT_STORE_123456");
  await page.getByRole("button", { name: "完成" }).click();
  if (page.viewportSize()?.width && page.viewportSize()!.width < 900) await page.getByRole("button", { name: "Test / Result" }).click();
  await page.getByLabel("待分析内容 *").fill("测试内容");
  await page.getByRole("button", { name: "运行 Interface" }).click();
  await expect(page.getByText("0.830")).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 JSON" }).click();
  const download = await downloadPromise;
  const exported = await (await import("node:fs/promises")).readFile(await download.path(), "utf8");
  expect(exported).not.toContain("TEST_SECRET_TYPESAFE_KEY_DO_NOT_STORE_123456");
  expect(JSON.parse(exported)).toMatchObject({ schemaVersion: "1.0" });
  await page.reload();
  await expect(page.getByRole("button", { name: "TypeSafe · 未设置" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("jev-typesafe-session-key"))).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem("jev-typesafe-session-key") === null)).toBe(true);
  expect(errors).toEqual([]);
});

test("游客导入现有 Manifest 并继续编辑", async ({ page }) => {
  await page.goto("/builder/new");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入" }).click();
  await (await chooser).setFiles({ name: "demo.manifest.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(manifest), "utf8") });
  await expect(page.getByRole("textbox", { name: "Interface 名称" })).toHaveValue("Demo");
  if (page.viewportSize()?.width && page.viewportSize()!.width < 900) await page.getByRole("button", { name: "Questions", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(3);
  await page.getByRole("button", { name: "复制" }).first().click();
  await expect(page.getByRole("article")).toHaveCount(4);
});

test("游客添加字段与 Score，预览 State 并导出配置", async ({ page }) => {
  await page.route("**/api/runtime/playground", async (route) => {
    const body = route.request().postDataJSON() as { manifest: { questions: Record<string, unknown> }; inputs: Record<string, string> };
    expect(body.inputs).toEqual({ content: "正文", field1: "补充信息" });
    expect(body.manifest.questions.question_1).toMatchObject({ type: "score" });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      result: { model: "jev-1.13.0", answers: {
        assessment: { type: "noul", noul: 0.5 },
        question_1: { type: "score", score: 0.75, legend: { "0": "低", "1": "高" }, probabilities: { "0": 0.25, "1": 0.75 }, confidence: 0.5 },
      }, usage: { input_tokens: 12, output_tokens: 3 } }, metrics: [],
    }) });
  });
  await page.goto("/builder/new");
  await page.getByRole("button", { name: "＋ 添加字段" }).click();
  await page.getByRole("combobox", { name: "控件类型" }).last().selectOption("textarea");
  if (page.viewportSize()?.width && page.viewportSize()!.width < 900) await page.getByRole("button", { name: "Questions", exact: true }).click();
  await page.getByRole("button", { name: "＋ Score" }).click();
  if (page.viewportSize()?.width && page.viewportSize()!.width < 900) await page.getByRole("button", { name: "Test / Result" }).click();
  await page.getByLabel("待分析内容 *").fill("正文");
  await page.getByLabel("新字段").fill("补充信息");
  await expect(page.getByText('"field1": "补充信息"').first()).toBeVisible();
  await page.getByRole("button", { name: "TypeSafe · 未设置" }).click();
  await page.getByLabel("你的 API Key").fill("TEST_KEY_NEW_INTERFACE");
  await page.getByRole("button", { name: "完成" }).click();
  await page.getByRole("button", { name: "运行 Interface" }).click();
  await expect(page.getByText("0.750 / 1")).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 JSON" }).click();
  const download = await downloadPromise;
  const json = JSON.parse(await (await import("node:fs/promises")).readFile(await download.path(), "utf8")) as { inputs: unknown[]; questions: Record<string, unknown> };
  expect(json.inputs).toHaveLength(2);
  expect(json.questions.question_1).toMatchObject({ type: "score" });
});

test("本机草稿可恢复，勾选后 Key 只留在浏览器会话", async ({ page }) => {
  await page.goto("/builder/new");
  await page.getByRole("textbox", { name: "Interface 名称" }).fill("我的判断接口");
  await page.getByRole("button", { name: "保存到本机" }).click();
  await page.getByRole("button", { name: "TypeSafe · 未设置" }).click();
  await page.getByLabel("你的 API Key").fill("TEMPORARY_TEST_KEY");
  await page.getByLabel("在当前浏览器会话中记住").check();
  await page.getByRole("button", { name: "完成" }).click();
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Interface 名称" })).toHaveValue("我的判断接口");
  await expect(page.getByRole("button", { name: "TypeSafe · 已设置" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("jev-typesafe-session-key"))).toBeNull();
});
