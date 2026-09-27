import { expect, test } from "@playwright/test";

test("JSON 调试编辑请求、运行并同步到基础模式和本机草稿", async ({ page }) => {
  const requests: { manifest: { stateTemplate: unknown; runtime: { model: string }; questions: Record<string, unknown>; inputs: { defaultValue: unknown }[] } }[] = [];
  await page.route("**/api/runtime/playground", async (route) => {
    const body = route.request().postDataJSON() as typeof requests[number];
    requests.push(body);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      result: { model: body.manifest.runtime.model, answers: { check: { type: "noul", noul: 0.83 } }, usage: { input_tokens: 1, output_tokens: 1 } },
      metrics: [],
    }) });
  });

  await page.goto("/builder/new");
  await page.getByRole("button", { name: "JSON 调试" }).click();
  const editor = page.getByRole("textbox", { name: "请求 JSON" });
  await expect(editor).toBeVisible();
  await expect(page.getByRole("heading", { name: "预览与运行" })).toBeVisible();
  const request = JSON.parse(await editor.inputValue()) as { state: unknown; model: string; questions: Record<string, unknown> };
  request.state = { content: "专业模式测试" };
  request.model = "jev-custom";
  request.questions = { check: { type: "noul", instructions: "内容是否有效？" } };

  await editor.fill("{");
  await page.getByRole("button", { name: "保存到本机" }).click();
  await expect(page.locator(".status-line")).toContainText("请求 JSON 格式无效");
  await page.getByRole("button", { name: "运行", exact: true }).click();
  await expect(page.locator(".professional-result-panel").getByRole("alert")).toHaveText("请求 JSON 格式无效");
  expect(requests).toHaveLength(0);

  await editor.fill(JSON.stringify(request, null, 2));
  await page.getByRole("button", { name: "设置 API Key" }).click();
  await page.getByLabel("你的 API Key").fill("TEST_KEY");
  await page.getByRole("button", { name: "完成" }).click();
  await page.getByRole("button", { name: "运行", exact: true }).click();
  await expect(page.getByText("0.830")).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0].manifest.stateTemplate).toEqual({ $input: "content" });
  expect(requests[0].manifest.inputs[0].defaultValue).toEqual(request.state);
  expect(requests[0].manifest.runtime.model).toBe(request.model);
  expect(requests[0].manifest.questions).toEqual(request.questions);

  await page.getByRole("button", { name: "保存到本机" }).click();
  await expect(page.locator(".status-line")).toHaveText("已保存到本机浏览器");
  await page.reload();
  await page.getByRole("button", { name: "JSON 调试" }).click();
  await expect(page.getByRole("textbox", { name: "请求 JSON" })).toHaveValue(JSON.stringify(request, null, 2));
  await page.getByRole("button", { name: "基础模式" }).click();
  if ((page.viewportSize()?.width ?? 1200) < 900) await page.getByRole("button", { name: "State", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "State 内容" })).toHaveValue(JSON.stringify(request.state, null, 2));
  if ((page.viewportSize()?.width ?? 1200) < 900) await page.getByRole("button", { name: "Questions", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "check JSON" })).toHaveValue(JSON.stringify(request.questions.check, null, 2));
});
