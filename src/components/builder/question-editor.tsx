"use client";

import { useState } from "react";
import type { Question } from "../../lib/manifest/types";

type Props = {
  id: string;
  question: Question;
  onRename: (nextId: string) => void;
  onChange: (question: Question) => void;
  onAdvancedSave: (value: unknown) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
  onDragStart: () => void;
  onDrop: () => void;
};

export function QuestionEditor({ id, question, onRename, onChange, onAdvancedSave, onDuplicate, onRemove, onMove, onDragStart, onDrop }: Props) {
  const [idDraft, setIdDraft] = useState(id);
  const [advanced, setAdvanced] = useState(false);
  const [jsonDraft, setJsonDraft] = useState(JSON.stringify(question, null, 2));
  const [error, setError] = useState("");

  function saveAdvanced() {
    try {
      onAdvancedSave(JSON.parse(jsonDraft) as unknown);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "JSON 无效");
    }
  }
  function changeType(type: Question["type"]) {
    const instructions = typeof question.instructions === "string" ? question.instructions : "请描述判断目标";
    if (type === "noul") onChange({ type, instructions });
    if (type === "choice") onChange({ type, instructions, criteria: { option_a: "选项 A", option_b: "选项 B" } });
    if (type === "score") onChange({ type, instructions, criteria: ["低", "高"] });
  }
  return <article className="editor-card" draggable onDragStart={onDragStart} onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
    <div className="editor-card-header"><strong className="mono">⋮⋮ {id}</strong><div className="editor-card-actions">
      <button className="button button-small" type="button" aria-label={`上移 ${id}`} onClick={() => onMove(-1)}>↑</button>
      <button className="button button-small" type="button" aria-label={`下移 ${id}`} onClick={() => onMove(1)}>↓</button>
      <button className="button button-small" type="button" onClick={onDuplicate}>复制</button>
      <button className="button button-small button-danger" type="button" onClick={onRemove}>删除</button>
    </div></div>
    <div className="field-row">
      <label className="field"><span>Question ID</span><input className="mono" value={idDraft} onChange={(event) => setIdDraft(event.target.value)} onBlur={() => { if (idDraft !== id) onRename(idDraft); }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /></label>
      <label className="field"><span>类型</span><select value={question.type} onChange={(event) => changeType(event.target.value as Question["type"])}>
        <option value="noul">Noul · 判断</option><option value="choice">Choice · 选择</option><option value="score">Score · 评分</option>
      </select></label>
    </div>
    <div className="section-head"><span className="field-hint">{question.type === "noul" ? "0–1 的判断值" : question.type === "choice" ? "2–255 个选项" : "2–10 个有序档位"}</span>
      <button className="button button-small button-quiet" type="button" onClick={() => { if (!advanced) setJsonDraft(JSON.stringify(question, null, 2)); setAdvanced(!advanced); setError(""); }}>{advanced ? "简单模式" : "高级 JSON"}</button></div>
    {advanced ? <div className="stack">
      <label className="field"><span>Question JSON</span><textarea className="mono" rows={12} value={jsonDraft} onChange={(event) => setJsonDraft(event.target.value)} /></label>
      <button className="button button-small" type="button" onClick={saveAdvanced}>应用 JSON</button>
    </div> : <SimpleQuestionFields question={question} onChange={onChange} />}
    {error && <p role="alert" className="error">{error}</p>}
  </article>;
}

function SimpleQuestionFields({ question, onChange }: { question: Question; onChange: (question: Question) => void }) {
  const instructions = typeof question.instructions === "string" ? question.instructions : null;
  return <div className="stack">
    {instructions === null ? <p className="notice">当前 instructions 为结构化 JSON，请使用高级模式编辑。</p>
      : <label className="field"><span>Instructions</span><textarea value={instructions} onChange={(event) => onChange({ ...question, instructions: event.target.value })} /></label>}
    {question.type === "noul" && <div className="field-row">
      <label className="field"><span>True criteria</span><input value={typeof question.criteria?.true === "string" ? question.criteria.true : ""} onChange={(event) => onChange({ ...question, criteria: { ...question.criteria, true: event.target.value } })} /></label>
      <label className="field"><span>False criteria</span><input value={typeof question.criteria?.false === "string" ? question.criteria.false : ""} onChange={(event) => onChange({ ...question, criteria: { ...question.criteria, false: event.target.value } })} /></label>
    </div>}
    {question.type === "choice" && <div className="stack">
      {Object.entries(question.criteria).map(([key, value], index) => <div className="option-line" key={index}>
        <input aria-label={`选项 ${index + 1} ID`} className="mono" value={key} onChange={(event) => {
          const entries = Object.entries(question.criteria);
          entries[index] = [event.target.value, value];
          onChange({ ...question, criteria: Object.fromEntries(entries) });
        }} />
        <input aria-label={`选项 ${index + 1} 描述`} value={typeof value === "string" ? value : ""} placeholder={typeof value === "string" ? "描述" : "结构化值，请用高级模式"} onChange={(event) => onChange({ ...question, criteria: { ...question.criteria, [key]: event.target.value } })} />
        <button className="button button-small" type="button" aria-label={`删除选项 ${index + 1}`} onClick={() => onChange({ ...question, criteria: Object.fromEntries(Object.entries(question.criteria).filter((_, at) => at !== index)) })}>×</button>
      </div>)}
      <button className="button button-small" type="button" onClick={() => {
        let count = 1;
        while (Object.hasOwn(question.criteria, `option_${count}`)) count++;
        onChange({ ...question, criteria: { ...question.criteria, [`option_${count}`]: "新选项" } });
      }}>＋ 添加选项</button>
    </div>}
    {question.type === "score" && <div className="stack">
      {question.criteria.map((level, index) => <div className="option-line" key={index}>
        <span className="mono">{index}</span><input aria-label={`档位 ${index} 描述`} value={typeof level === "string" ? level : ""} placeholder={typeof level === "string" ? "档位描述" : "结构化值，请用高级模式"} onChange={(event) => onChange({ ...question, criteria: question.criteria.map((entry, at) => at === index ? event.target.value : entry) })} />
        <button className="button button-small" type="button" aria-label={`删除档位 ${index}`} onClick={() => onChange({ ...question, criteria: question.criteria.filter((_, at) => at !== index) })}>×</button>
      </div>)}
      <button className="button button-small" type="button" disabled={question.criteria.length >= 10} onClick={() => onChange({ ...question, criteria: [...question.criteria, "新档位"] })}>＋ 添加档位</button>
    </div>}
  </div>;
}
