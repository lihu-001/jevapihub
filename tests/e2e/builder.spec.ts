import { expect, test } from "@playwright/test";
import { createStarterManifest } from "../../src/lib/manifest/starter";

async function openTab(page: import("@playwright/test").Page, name: "State" | "Questions" | "结果") {
  if ((page.viewportSize()?.width ?? 1200) < 900) await page.getByRole("button", { name, exact: true }).click();
}

type MockQuestion = { type: string; criteria?: Record<string, string> | string[] };

function answersFor(questions: Record<string, MockQuestion>) {
  return Object.fromEntries(Object.entries(questions).map(([id, question]) => {
    if (question.type === "noul") return [id, { type: "noul", noul: 0.83 }];
    if (question.type === "choice") {
      const keys = Object.keys(question.criteria as Record<string, string>);
      const selected = Math.min(1, keys.length - 1);
      return [id, { type: "choice", choice: keys[selected], probabilities: Object.fromEntries(keys.map((key, index) => [key, index === selected ? 0.8 : index === 0 ? 0.2 : 0])), confidence: 0.8 }];
    }
    const criteria = question.criteria as string[];
    return [id, { type: "score", score: 1, legend: Object.fromEntries(criteria.map((value, index) => [String(index), value])),
      probabilities: Object.fromEntries(criteria.map((_, index) => [String(index), index === 0 ? 0.2 : index === 1 ? 0.8 : 0])), confidence: 0.8 }];
  }));
}

test("三栏 Builder 使用 State 和 Questions 运行并查看完整结果", async ({ page, context }) => {
  const requests: unknown[] = [];
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.route("**/api/runtime/playground", async (route) => {
    const body = route.request().postDataJSON() as { manifest: { stateTemplate: unknown; inputs: unknown[]; questions: Record<string, MockQuestion> }; inputs: unknown };
    requests.push(body);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      result: { model: "jev-latest", answers: answersFor(body.manifest.questions), usage: { input_tokens: 10, output_tokens: 2 } }, metrics: [],
    }) });
  });
  await page.goto("/builder/new");
  await expect(page.locator("#state-title")).toHaveText("State");
  await expect(page.locator("#questions-title")).toHaveText("Questions");
  await expect(page.locator("#run-title")).toHaveText("预览与运行");
  for (const name of ["导入", "粘贴 JSON", "导出 JSON", "代码导出"]) {
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
  }
  await expect(page.getByRole("textbox", { name: "State 内容" })).toHaveValue("您好，我尝试连接 Stripe 账户已经三天了，但集成一直失败，导致我流失了销售额。请尽快协助解决。");
  await page.getByRole("textbox", { name: "State 内容" }).fill("普通文本 State");
  await openTab(page, "Questions");
  const department = page.getByRole("textbox", { name: "department JSON" });
  const departmentValue = JSON.parse(await department.inputValue()) as { type: string; instructions: string; criteria: Record<string, string> };
  expect(departmentValue).toEqual({ type: "choice", instructions: "应由哪个团队处理此问题", criteria: { "支付": "支付或订阅相关问题", "技术": "程序错误（Bug）或集成问题", "销售": "定价或账户相关问题" } });
  expect(JSON.parse(await page.getByRole("textbox", { name: "frustration JSON" }).inputValue())).toEqual({ type: "score", instructions: "客户表现出的沮丧程度", criteria: ["情绪平静，仅陈述事实", "感到沮丧但态度客气", "非常愤怒，言辞激烈"] });
  expect(JSON.parse(await page.getByRole("textbox", { name: "is_urgent JSON" }).inputValue())).toEqual({ type: "noul", instructions: "该信息传达了紧迫性或时间敏感性" });
  departmentValue.criteria["技术"] = "技术集成问题";
  await department.fill(JSON.stringify(departmentValue, null, 2));
  await openTab(page, "结果");
  await expect(page.locator(".builder-header").getByRole("button", { name: "设置 API Key" })).toBeVisible();
  await expect(page.locator(".workspace-panel").getByRole("button", { name: "设置 API Key" })).toHaveCount(0);
  await page.getByRole("button", { name: "设置 API Key" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "关闭" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "设置 API Key" }).click();
  await page.getByLabel("你的 API Key").fill("TEST_KEY");
  await page.getByRole("button", { name: "完成" }).click();
  await page.getByRole("button", { name: "运行", exact: true }).click();
  await expect(page.getByText("0.830")).toBeVisible();
  const departmentResult = page.locator(".result-block").filter({ has: page.getByRole("heading", { name: /department/ }) });
  await expect(departmentResult.locator(".answer-value")).toHaveText("技术");
  await expect(page.getByText("1.000")).toBeVisible();
  await expect(departmentResult.locator(".result-question")).toHaveText("应由哪个团队处理此问题");
  await expect(departmentResult.locator(".result-explanation")).toHaveText("选项说明：技术集成问题");
  const frustrationResult = page.locator(".result-block").filter({ has: page.getByRole("heading", { name: /frustration/ }) });
  await expect(frustrationResult.locator(".result-question")).toHaveText("客户表现出的沮丧程度");
  await expect(frustrationResult.locator(".result-explanation")).toHaveText("加权得分，范围 0–2；从「情绪平静，仅陈述事实」到「非常愤怒，言辞激烈」。");
  const urgentResult = page.locator(".result-block").filter({ has: page.getByRole("heading", { name: /is_urgent/ }) });
  await expect(urgentResult.locator(".result-question")).toHaveText("该信息传达了紧迫性或时间敏感性");
  await expect(urgentResult.locator(".result-explanation")).toHaveText("取值 0–1；越接近 1，越倾向符合这项判断。");
  await page.getByRole("button", { name: "响应详情", exact: true }).click();
  await expect(page.locator("#response-json")).toContainText('"input_tokens": 10');
  await expect(page.locator("#response-json")).toContainText('"metrics": []');
  await page.getByRole("button", { name: "请求详情", exact: true }).click();
  const sent = requests[0] as { manifest: { stateTemplate: unknown; runtime: { model: string }; questions: unknown }; inputs: unknown };
  expect(JSON.parse((await page.locator("#request-json").textContent()) ?? "")).toEqual({
    state: (sent.inputs as { content: unknown }).content, model: sent.manifest.runtime.model, questions: sent.manifest.questions,
  });
  expect((sent.manifest.questions as Record<string, { criteria: Record<string, string> }>).department.criteria["技术"]).toBe("技术集成问题");
  await expect(page.locator("#request-json")).not.toContainText("TEST_KEY");
  await page.getByRole("button", { name: "复制响应 JSON" }).click();
  await expect(page.locator(".json-detail").filter({ has: page.locator("#response-json") }).getByRole("status")).toHaveText("已复制");
  expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n")).toBe(await page.locator("#response-json").textContent());
  await page.getByRole("button", { name: "复制请求 JSON" }).click();
  await expect(page.locator(".json-detail").filter({ has: page.locator("#request-json") }).getByRole("status")).toHaveText("已复制");
  expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n")).toBe(await page.locator("#request-json").textContent());
  expect((requests[0] as { manifest: { stateTemplate: unknown; inputs: { defaultValue: unknown }[] }; inputs: { content: unknown } }).manifest.stateTemplate).toEqual({ $input: "content" });
  expect((requests[0] as { manifest: { inputs: { defaultValue: unknown }[] } }).manifest.inputs[0].defaultValue).toBe("普通文本 State");
  expect((requests[0] as { inputs: { content: unknown } }).inputs).toEqual({ content: "普通文本 State" });
});

test("从请求详情进入 JSON 调试，格式错误时不发送请求", async ({ page }) => {
  const requests: { manifest: { stateTemplate: unknown; runtime: { model: string }; questions: Record<string, MockQuestion>; inputs: { defaultValue: unknown }[] } }[] = [];
  await page.route("**/api/runtime/playground", async (route) => {
    const body = route.request().postDataJSON() as typeof requests[number];
    requests.push(body);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      result: { model: body.manifest.runtime.model, answers: answersFor(body.manifest.questions), usage: { input_tokens: 10, output_tokens: 2 } }, metrics: [],
    }) });
  });
  await page.goto("/builder/new");
  await openTab(page, "结果");
  await page.getByRole("button", { name: "设置 API Key" }).click();
  await page.getByLabel("你的 API Key").fill("TEST_KEY");
  await page.getByRole("button", { name: "完成" }).click();
  await page.getByRole("button", { name: "运行", exact: true }).click();
  await expect(page.getByText("0.830")).toBeVisible();
  await page.getByRole("button", { name: "请求详情", exact: true }).click();
  const edited = JSON.parse((await page.locator("#request-json").textContent()) ?? "") as { state: unknown; model: string; questions: Record<string, MockQuestion & { instructions: string }> };
  await page.getByRole("button", { name: "在 JSON 调试中编辑" }).click();
  const editor = page.getByRole("textbox", { name: "请求 JSON" });
  edited.state = "从请求详情修改的 State";
  edited.model = "jev-edited";
  edited.questions.department.instructions = "修改后的部门问题";
  delete edited.questions.frustration;
  await editor.fill("{");
  await page.getByRole("button", { name: "运行", exact: true }).click();
  await expect(page.locator('[aria-labelledby="run-title"]').getByRole("alert")).toHaveText("请求 JSON 格式无效");
  await expect(editor).toHaveValue("{");
  expect(requests).toHaveLength(1);

  await editor.fill(JSON.stringify(edited, null, 2));
  await page.getByRole("button", { name: "运行", exact: true }).click();
  await expect(page.locator('[aria-labelledby="run-title"]').getByRole("alert")).toHaveCount(0);
  await expect(page.locator(".result-question").first()).toHaveText("修改后的部门问题");
  await expect(page.getByRole("heading", { name: /frustration/ })).toHaveCount(0);
  expect(requests).toHaveLength(2);
  expect(requests[1].manifest.stateTemplate).toEqual({ $input: "content" });
  expect(requests[1].manifest.inputs[0].defaultValue).toBe(edited.state);
  expect(requests[1].manifest.runtime.model).toBe(edited.model);
  expect(requests[1].manifest.questions).toEqual(edited.questions);
  await expect(editor).toHaveValue(JSON.stringify(edited, null, 2));
  await page.getByRole("button", { name: "基础模式" }).click();
  await openTab(page, "State");
  await expect(page.getByRole("textbox", { name: "State 内容" })).toHaveValue(String(edited.state));
});

test("State 文本框接受 JSON 字符串、对象和数组", async ({ page }) => {
  const sent: unknown[] = [];
  await page.route("**/api/runtime/playground", async (route) => {
    const body = route.request().postDataJSON() as { manifest: { questions: Record<string, MockQuestion> }; inputs: { content: unknown } };
    sent.push(body.inputs.content);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      result: { model: "jev-latest", answers: answersFor(body.manifest.questions), usage: { input_tokens: 1, output_tokens: 1 } }, metrics: [],
    }) });
  });
  await page.goto("/builder/new");
  await openTab(page, "结果");
  await page.getByRole("button", { name: "设置 API Key" }).click();
  await page.getByLabel("你的 API Key").fill("TEST_KEY");
  await page.getByRole("button", { name: "完成" }).click();
  for (const value of ['"JSON 字符串"', '{"topic":"测试"}', '["第一项","第二项"]']) {
    await openTab(page, "State");
    await page.getByRole("textbox", { name: "State 内容" }).fill(value);
    await openTab(page, "结果");
    await page.getByRole("button", { name: "运行", exact: true }).click();
    await expect(page.getByText("0.830")).toBeVisible();
  }
  expect(sent).toEqual(["JSON 字符串", { topic: "测试" }, ["第一项", "第二项"]]);
});

test("Question ID 可修改并随本机草稿保存，重名会被拒绝", async ({ page }) => {
  await page.goto("/builder/new");
  await openTab(page, "Questions");
  await page.getByRole("button", { name: "＋ Choice" }).click();
  const defaultId = page.getByRole("textbox", { name: "question_1 ID" });
  await expect(defaultId).toHaveValue("question_1");
  await defaultId.fill("department");
  await defaultId.press("Enter");
  await expect(defaultId).toHaveValue("question_1");
  await expect(page.getByRole("status")).toContainText("Question ID 必须唯一");

  await defaultId.fill("my_choice");
  await defaultId.press("Enter");
  await expect(page.getByRole("textbox", { name: "my_choice ID" })).toHaveValue("my_choice");
  const myChoice = page.getByRole("textbox", { name: "my_choice JSON" });
  const myChoiceValue = JSON.parse(await myChoice.inputValue()) as { type: string; instructions: string; criteria: Record<string, string> };
  myChoiceValue.instructions = "选择哪个选项？";
  await myChoice.fill(JSON.stringify(myChoiceValue, null, 2));
  await page.getByRole("button", { name: "保存到本机" }).click();
  await page.reload();
  await openTab(page, "Questions");
  await expect(page.getByRole("textbox", { name: "my_choice ID" })).toHaveValue("my_choice");
  expect(JSON.parse(await page.getByRole("textbox", { name: "my_choice JSON" }).inputValue())).toEqual(myChoiceValue);
});

test("问题 JSON 无效时阻止保存和运行，修正后可继续编辑", async ({ page }) => {
  let requestCount = 0;
  await page.route("**/api/runtime/playground", async (route) => { requestCount++; await route.abort(); });
  await page.goto("/builder/new");
  await openTab(page, "Questions");
  const department = page.getByRole("textbox", { name: "department JSON" });
  const original = JSON.parse(await department.inputValue()) as { criteria: Record<string, string> };
  await department.fill("{");
  await expect(page.locator('[aria-labelledby="questions-title"]').getByRole("alert")).toContainText("department JSON 无效");
  await page.getByRole("button", { name: "保存到本机" }).click();
  await expect(page.locator(".status-line")).toContainText("department JSON 无效");
  await openTab(page, "结果");
  await page.getByRole("button", { name: "运行", exact: true }).click();
  await expect(page.locator('[aria-labelledby="run-title"]').getByRole("alert")).toContainText("department JSON 无效");
  expect(requestCount).toBe(0);
  await openTab(page, "Questions");
  original.criteria["技术"] = "可修改的技术选项";
  await department.fill(JSON.stringify(original, null, 2));
  await expect(page.locator(".builder-shell").getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "保存到本机" }).click();
  await expect(page.locator(".status-line")).toContainText("已保存到本机浏览器");
});

test("旧版本机草稿不覆盖新默认示例，仍可手动恢复", async ({ page }) => {
  const legacy = JSON.stringify({ ...createStarterManifest(), inputs: [], stateTemplate: { content: "" } });
  await page.goto("/builder/new");
  await page.evaluate((draft) => localStorage.setItem("jev-interface-local-draft", draft), legacy);
  await page.reload();

  await expect(page.getByRole("textbox", { name: "State 内容" })).toHaveValue("您好，我尝试连接 Stripe 账户已经三天了，但集成一直失败，导致我流失了销售额。请尽快协助解决。");
  await openTab(page, "Questions");
  await expect(page.getByRole("textbox", { name: "department JSON" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "assessment JSON" })).toHaveCount(0);
  await page.getByRole("button", { name: "恢复旧草稿" }).click();
  await expect(page.getByRole("textbox", { name: "assessment JSON" })).toBeVisible();
  await page.reload();
  await openTab(page, "Questions");
  await expect(page.getByRole("textbox", { name: "assessment JSON" })).toBeVisible();
  await openTab(page, "State");
  await expect(page.getByRole("textbox", { name: "State 内容" })).toHaveValue('{\n  "content": ""\n}');
});
