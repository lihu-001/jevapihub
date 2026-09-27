import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { RunPanel } from "../../src/components/builder/run-panel";
import { prepareBuilderRequest } from "../../src/lib/manifest/builder-request";
import { createBuilderDefaultManifest } from "../../src/lib/manifest/starter";

it("shows a Builder-published example in the Hub input control", () => {
  const { prepared } = prepareBuilderRequest(createBuilderDefaultManifest(), "作者的示例", "");
  const html = renderToStaticMarkup(createElement(RunPanel, {
    manifest: prepared, stateText: JSON.stringify(prepared.stateTemplate), apiKey: "", onOpenKey: () => undefined,
  }));
  expect(html).toMatch(/<textarea[^>]*id="run-content"[^>]*>作者的示例<\/textarea>/);
  expect(html).toContain("待分析内容");
});

it("labels older versions that have no runtime input", () => {
  const legacy = createBuilderDefaultManifest();
  const html = renderToStaticMarkup(createElement(RunPanel, {
    manifest: legacy, stateText: legacy.stateTemplate as string, apiKey: "", onOpenKey: () => undefined,
  }));
  expect(html).toContain("此版本使用固定 State");
  expect(html).not.toContain('id="run-content"');
});
