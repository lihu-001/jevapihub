import { describe, expect, it } from "vitest";
import { automaticArrayStateTemplate, automaticStateTemplate, formatStateEditor, isAutomaticStateTemplate, readStateEditor } from "../../src/lib/manifest/state-editor";
import { createStarterManifest } from "../../src/lib/manifest/starter";
import { resolveState } from "../../src/lib/manifest/resolve-state";

describe("State 编辑器", () => {
  it("默认单个文本输入作为普通字符串 State 发送", () => {
    const starter = createStarterManifest();
    expect(isAutomaticStateTemplate(starter.stateTemplate, starter.inputs)).toBe(true);
    expect(resolveState(starter.stateTemplate, { content: "人类是猴子吗" })).toBe("人类是猴子吗");
  });

  it("添加、重命名和删除字段时自动生成对应的 State", () => {
    const [content] = createStarterManifest().inputs;
    const extra = { ...content, id: "note", label: "补充说明" };
    expect(automaticStateTemplate([content, extra])).toEqual({ content: { $input: "content" }, note: { $input: "note" } });
    expect(automaticArrayStateTemplate([content, extra])).toEqual([{ $input: "content" }, { $input: "note" }]);
    expect(isAutomaticStateTemplate(automaticArrayStateTemplate([content, extra]), [content, extra])).toBe(true);
    expect(isAutomaticStateTemplate({ content: { $input: "content" } }, [content])).toBe(true);
    expect(isAutomaticStateTemplate({ custom: { $input: "content" } }, [content])).toBe(false);
    expect(automaticStateTemplate([{ ...content, id: "renamed" }])).toEqual({ $input: "renamed" });
    expect(automaticStateTemplate([{ ...content, id: "renamed" }], true)).toEqual({ renamed: { $input: "renamed" } });
    expect(automaticStateTemplate([])).toBe("");
  });
  it("字符串 State 按原文显示和保存，不要求 JSON 引号", () => {
    const state = "人类是猴子吗";
    expect(formatStateEditor(state)).toBe(state);
    expect(readStateEditor("这是普通文本，含 { } 和 \"引号\"", state)).toBe("这是普通文本，含 { } 和 \"引号\"");
  });

  it("已有结构化 State 仍按 JSON 模板编辑", () => {
    const template = { content: { $input: "content" } };
    const text = formatStateEditor(template);
    expect(readStateEditor(text, template)).toEqual(template);
  });
});
