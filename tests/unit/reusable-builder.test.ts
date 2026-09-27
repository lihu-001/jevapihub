import { describe, expect, it } from "vitest";
import { prepareBuilderRequest, prepareEditedRequest } from "../../src/lib/manifest/builder-request";
import { resolveState } from "../../src/lib/manifest/resolve-state";
import { simplifyManifest } from "../../src/lib/manifest/simple-builder";
import { createBuilderDefaultManifest } from "../../src/lib/manifest/starter";
import { validateInputs } from "../../src/lib/manifest/validate-inputs";

describe("Builder 发布的运行时输入", () => {
  it("把文本示例转成 Hub 可填写的输入，并保持草稿往返编辑", () => {
    const { prepared, request } = prepareBuilderRequest(createBuilderDefaultManifest(), "新的示例文本", "");
    expect(request.state).toBe("新的示例文本");
    expect(prepared.stateTemplate).toEqual({ $input: "content" });
    expect(prepared.inputs).toMatchObject([{ id: "content", component: "textarea", required: true, defaultValue: "新的示例文本" }]);
    expect(resolveState(prepared.stateTemplate, validateInputs(prepared, { content: "访客自己的内容" }))).toBe("访客自己的内容");
    expect(simplifyManifest(prepared).stateTemplate).toBe("新的示例文本");
  });

  it("让 JSON State 成为可替换的 JSON 输入", () => {
    const { prepared } = prepareEditedRequest(JSON.stringify({
      state: { article: "示例" }, model: "jev-latest", questions: createBuilderDefaultManifest().questions,
    }), createBuilderDefaultManifest());
    expect(prepared.inputs).toMatchObject([{ id: "content", component: "json", defaultValue: { article: "示例" } }]);
    expect(resolveState(prepared.stateTemplate, validateInputs(prepared, { content: { article: "访客内容" } }))).toEqual({ article: "访客内容" });
  });
});
