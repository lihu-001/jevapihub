"use client";

import type { InputDefinition } from "../../lib/manifest/types";

type Props = { inputs: InputDefinition[]; onChange: (inputs: InputDefinition[]) => void };

function nextId(inputs: InputDefinition[]) {
  let count = 1;
  while (inputs.some((input) => input.id === `field${count}`)) count++;
  return `field${count}`;
}

export function InputEditor({ inputs, onChange }: Props) {
  function update(index: number, change: Partial<InputDefinition>) {
    onChange(inputs.map((input, position) => {
      if (position !== index) return input;
      const next = { ...input, ...change };
      if (next.options === undefined) delete next.options;
      if (next.constraints) next.constraints = Object.fromEntries(Object.entries(next.constraints).filter(([, value]) => value !== undefined));
      return next;
    }));
  }
  function changeComponent(index: number, component: InputDefinition["component"]) {
    const valueType = component === "number" ? "number" : component === "boolean" ? "boolean" : component === "json" ? "json" : "string";
    update(index, { component, valueType, options: component === "select" ? [{ label: "选项 A", value: "a" }, { label: "选项 B", value: "b" }] : undefined });
  }
  return <section aria-labelledby="input-title">
    <div className="section-head"><h2 id="input-title">输入字段</h2><button className="button button-small" type="button" onClick={() => onChange([...inputs, {
      id: nextId(inputs), label: "新字段", component: "text", valueType: "string", required: false,
    }])}>＋ 添加字段</button></div>
    {inputs.length === 0 && <p className="muted">还没有输入字段。可以先添加一个文本字段。</p>}
    {inputs.map((input, index) => <div className="editor-card" key={index}>
      <div className="editor-card-header"><strong>{input.label || input.id || `字段 ${index + 1}`}</strong><button className="button button-small button-danger" type="button" onClick={() => onChange(inputs.filter((_, position) => position !== index))}>删除</button></div>
      <div className="field-row">
        <label className="field"><span>字段 ID</span><input value={input.id} onChange={(event) => update(index, { id: event.target.value })} className="mono" /></label>
        <label className="field"><span>显示名称</span><input value={input.label} onChange={(event) => update(index, { label: event.target.value })} /></label>
      </div>
      <div className="field-row">
        <label className="field"><span>控件类型</span><select value={input.component} onChange={(event) => changeComponent(index, event.target.value as InputDefinition["component"])}>
          <option value="text">单行文本</option><option value="textarea">多行文本</option><option value="number">数字</option><option value="boolean">布尔值</option><option value="select">下拉选项</option><option value="json">JSON</option>
        </select></label>
        <label className="field"><span>说明</span><input value={input.description ?? ""} onChange={(event) => update(index, { description: event.target.value })} /></label>
      </div>
      <label className="checkline"><input type="checkbox" checked={input.required} onChange={(event) => update(index, { required: event.target.checked })} />必填</label>
      {(input.component === "text" || input.component === "textarea") && <label className="field"><span>最大字符数</span><input type="number" min="1" value={input.constraints?.maxLength ?? ""} onChange={(event) => update(index, { constraints: { ...input.constraints, maxLength: event.target.value ? Number(event.target.value) : undefined } })} /></label>}
      {input.component === "select" && <div className="stack">
        <span className="field-hint">选项值会作为输入传给 State</span>
        {(input.options ?? []).map((option, optionIndex) => <div className="option-line" key={optionIndex}>
          <input aria-label={`选项 ${optionIndex + 1} 的值`} value={String(option.value)} onChange={(event) => update(index, { options: input.options?.map((entry, at) => at === optionIndex ? { ...entry, value: event.target.value } : entry) })} />
          <input aria-label={`选项 ${optionIndex + 1} 的名称`} value={option.label} onChange={(event) => update(index, { options: input.options?.map((entry, at) => at === optionIndex ? { ...entry, label: event.target.value } : entry) })} />
          <button className="button button-small" type="button" aria-label={`删除选项 ${optionIndex + 1}`} onClick={() => update(index, { options: input.options?.filter((_, at) => at !== optionIndex) })}>×</button>
        </div>)}
        <button className="button button-small" type="button" onClick={() => update(index, { options: [...(input.options ?? []), { label: "新选项", value: `option${(input.options?.length ?? 0) + 1}` }] })}>＋ 添加选项</button>
      </div>}
    </div>)}
  </section>;
}
