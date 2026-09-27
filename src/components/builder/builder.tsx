"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { createStarterManifest } from "../../lib/manifest/starter";
import type { InputDefinition, Manifest, Question } from "../../lib/manifest/types";
import { parseManifest, ManifestValidationError } from "../../lib/manifest/validate";
import { generateExport, type ExportFormat } from "../../lib/export/generate";
import { CredentialDialog } from "../credentials/credential-dialog";
import { AiBuilderPanel } from "./ai-builder-panel";
import { InputEditor } from "./input-editor";
import { QuestionEditor } from "./question-editor";
import { RunPanel } from "./run-panel";
import { TestSuitePanel } from "./test-suite-panel";

const DRAFT_KEY = "jev-interface-local-draft";
const SESSION_KEY = "jev-typesafe-session-key";
const QUESTION_ID = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;
type Visibility = "private" | "unlisted" | "public";

function issueMessage(error: unknown) {
  if (error instanceof ManifestValidationError) return error.issues.join("；");
  return error instanceof Error ? error.message : "操作失败";
}

function nextQuestionId(questions: Manifest["questions"]) {
  let count = 1;
  while (Object.hasOwn(questions, `question_${count}`)) count++;
  return `question_${count}`;
}

export function Builder({ initialManifest, cloudId, canCloudSave = false, initialVisibility = "private", initialAiGenerated = false }: {
  initialManifest?: Manifest; cloudId?: string; canCloudSave?: boolean; initialVisibility?: Visibility; initialAiGenerated?: boolean;
}) {
  const router = useRouter();
  const [manifest, setManifest] = useState<Manifest>(() => initialManifest ?? createStarterManifest());
  const [stateText, setStateText] = useState(() => JSON.stringify((initialManifest ?? createStarterManifest()).stateTemplate, null, 2));
  const [activeCloudId, setActiveCloudId] = useState(cloudId);
  const [visibility, setVisibility] = useState<Visibility>(initialVisibility);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishModel, setPublishModel] = useState(manifest.runtime.model);
  const [apiKey, setApiKey] = useState("");
  const [remember, setRemember] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);
  const [tab, setTab] = useState<"inputs" | "questions" | "test">("inputs");
  const [status, setStatus] = useState("");
  const [rawOpen, setRawOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(initialAiGenerated);
  const [rawText, setRawText] = useState("");
  const dragged = useRef<string | null>(null);
  const importInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      try {
        const savedKey = sessionStorage.getItem(SESSION_KEY);
        if (savedKey) { setApiKey(savedKey); setRemember(true); }
        const saved = cloudId ? null : localStorage.getItem(DRAFT_KEY);
        if (saved) {
          const parsed = parseManifest(JSON.parse(saved) as unknown);
          setManifest(parsed);
          setStateText(JSON.stringify(parsed.stateTemplate, null, 2));
          setStatus("已载入本机草稿");
        }
      } catch { setStatus("本机草稿无法读取，可继续新建"); }
    }, 0);
    return () => window.clearTimeout(handle);
  }, [cloudId]);

  function changeKey(value: string) {
    setApiKey(value);
    if (remember) {
      if (value) sessionStorage.setItem(SESSION_KEY, value);
      else sessionStorage.removeItem(SESSION_KEY);
    }
  }
  function changeRemember(value: boolean) {
    setRemember(value);
    if (value && apiKey) sessionStorage.setItem(SESSION_KEY, apiKey);
    else sessionStorage.removeItem(SESSION_KEY);
  }
  function clearKey() { setApiKey(""); setRemember(false); sessionStorage.removeItem(SESSION_KEY); }
  function currentManifest() { return parseManifest({ ...manifest, stateTemplate: JSON.parse(stateText) as unknown }); }

  function handleInputs(next: InputDefinition[]) {
    const added = next.find((input) => !manifest.inputs.some((existing) => existing.id === input.id));
    if (added) {
      try {
        const template = JSON.parse(stateText) as unknown;
        if (template && typeof template === "object" && !Array.isArray(template) && !("$input" in template)) {
          setStateText(JSON.stringify({ ...template, [added.id]: { $input: added.id } }, null, 2));
        }
      } catch { /* Keep the user's invalid JSON for manual correction. */ }
    }
    setManifest((current) => ({ ...current, inputs: next }));
  }
  function addQuestion(type: Question["type"]) {
    const id = nextQuestionId(manifest.questions);
    const instructions = "请描述要判断的问题";
    const question: Question = type === "noul" ? { type, instructions }
      : type === "choice" ? { type, instructions, criteria: { option_a: "选项 A", option_b: "选项 B" } }
        : { type, instructions, criteria: ["低", "高"] };
    setManifest((current) => ({ ...current, questions: { ...current.questions, [id]: question }, resultView: { ...current.resultView, order: [...current.resultView.order, id] } }));
  }
  function renameQuestion(id: string, nextId: string) {
    if (!QUESTION_ID.test(nextId) || (nextId !== id && Object.hasOwn(manifest.questions, nextId))) {
      setStatus("Question ID 必须唯一，且以字母开头，只能包含字母、数字、_、-");
      return;
    }
    const questions = Object.fromEntries(Object.entries(manifest.questions).map(([key, value]) => [key === id ? nextId : key, value]));
    setManifest((current) => ({ ...current, questions, resultView: { ...current.resultView, order: current.resultView.order.map((key) => key === id ? nextId : key) },
      postprocess: current.postprocess?.kind === "weighted_score" ? { ...current.postprocess, metrics: current.postprocess.metrics.map((metric) => ({ ...metric, sources: metric.sources.map((source) => source.questionId === id ? { ...source, questionId: nextId } : source) })) } : current.postprocess,
    }));
    setStatus("已更新 Question ID");
  }
  function removeQuestion(id: string) {
    setManifest((current) => ({ ...current, questions: Object.fromEntries(Object.entries(current.questions).filter(([key]) => key !== id)), resultView: { ...current.resultView, order: current.resultView.order.filter((key) => key !== id) } }));
  }
  function duplicateQuestion(id: string) {
    const nextId = nextQuestionId(manifest.questions);
    setManifest((current) => ({ ...current,
      questions: { ...current.questions, [nextId]: structuredClone(current.questions[id]) },
      resultView: { ...current.resultView, order: [...current.resultView.order, nextId] },
    }));
  }
  function reorderQuestion(id: string, target: string) {
    if (id === target) return;
    setManifest((current) => {
      const order = current.resultView.order.filter((key) => key !== id);
      const index = order.indexOf(target);
      if (index < 0) return current;
      order.splice(index, 0, id);
      return { ...current, resultView: { ...current.resultView, order } };
    });
  }
  function moveQuestion(id: string, direction: -1 | 1) {
    const index = manifest.resultView.order.indexOf(id);
    const target = manifest.resultView.order[index + direction];
    if (target) reorderQuestion(direction === 1 ? target : id, direction === 1 ? id : target);
  }
  function applyAdvancedQuestion(id: string, value: unknown) {
    const candidate = parseManifest({ ...manifest, stateTemplate: JSON.parse(stateText) as unknown, questions: { ...manifest.questions, [id]: value } });
    setManifest(candidate);
    setStatus(`已应用 ${id} 的高级 JSON`);
  }
  function saveLocal() {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(currentManifest())); setStatus("已保存到本机浏览器"); }
    catch (error) { setStatus(issueMessage(error)); }
  }
  async function cloudRequest(path: string, method: string, body: unknown) {
    const response = await fetch(path, { method, cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json() as { interface?: { id: string }; version?: { versionNumber: number }; error?: { message?: string } };
    if (!response.ok) throw new Error(data.error?.message ?? "云端操作失败");
    return data;
  }
  async function saveCloud() {
    try {
      const value = currentManifest();
      if (activeCloudId) {
        await cloudRequest(`/api/interfaces/${activeCloudId}/draft`, "PUT", { manifest: value, aiGenerated });
        setStatus("Draft 已保存到云端");
      } else {
        const created = await cloudRequest("/api/interfaces", "POST", { manifest: value, aiGenerated });
        const id = created.interface?.id;
        if (!id) throw new Error("云端创建失败");
        setActiveCloudId(id);
        setStatus("Interface 已创建，Draft 已保存到云端");
        router.replace(`/builder/${id}`);
      }
    } catch (error) { setStatus(issueMessage(error)); }
  }
  async function publish() {
    if (!activeCloudId) return;
    try {
      const value = currentManifest();
      const publishedDraft = { ...value, runtime: { ...value.runtime, model: publishModel } };
      await cloudRequest(`/api/interfaces/${activeCloudId}/draft`, "PUT", { manifest: publishedDraft, aiGenerated });
      const result = await cloudRequest(`/api/interfaces/${activeCloudId}/publish`, "POST", { visibility });
      setManifest(publishedDraft);
      setPublishOpen(false);
      setStatus(`已发布 v${result.version?.versionNumber ?? "?"}`);
      router.refresh();
    } catch (error) { setStatus(issueMessage(error)); }
  }
  function exportManifest(format: ExportFormat = "manifest") {
    try {
      const value = currentManifest();
      const exported = generateExport(value, format);
      const blob = new Blob([exported.content], { type: exported.contentType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = exported.filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setStatus("Manifest 已导出");
    } catch (error) { setStatus(issueMessage(error)); }
  }
  async function importManifest(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 512 * 1024) throw new Error("Manifest 文件不能超过 512 KB");
      const value = parseManifest(JSON.parse(await file.text()) as unknown);
      setManifest(value);
      setAiGenerated(false);
      setStateText(JSON.stringify(value.stateTemplate, null, 2));
      setStatus("Manifest 已导入");
    } catch (error) { setStatus(issueMessage(error)); }
    event.target.value = "";
  }
  function applyRaw() {
    try {
      const value = parseManifest(JSON.parse(rawText) as unknown);
      setManifest(value);
      setAiGenerated(false);
      setStateText(JSON.stringify(value.stateTemplate, null, 2));
      setRawOpen(false);
      setStatus("Raw Manifest 已应用");
    } catch (error) { setStatus(issueMessage(error)); }
  }

  return <div className="builder-shell">
    <header className="builder-header">
      <Link className="brand" href="/">Jev / Interface Hub</Link>
      <input className="name-input" aria-label="Interface 名称" value={manifest.metadata.name} onChange={(event) => setManifest((current) => ({ ...current, metadata: { ...current.metadata, name: event.target.value } }))} />
      <div className="header-actions">
        <button className="button button-small" type="button" onClick={() => setKeyOpen(true)}>{apiKey ? "TypeSafe · 已设置" : "TypeSafe · 未设置"}</button>
        <button className="button button-small" type="button" onClick={saveLocal}>保存到本机</button>
        {canCloudSave ? <button className="button button-small" type="button" onClick={saveCloud}>保存到云端</button>
          : <Link className="button button-small" href="/login">登录后云端保存</Link>}
        {activeCloudId && <><button className="button button-small button-primary" type="button" onClick={() => { setPublishModel(manifest.runtime.model); setPublishOpen(true); }}>发布版本</button>
          <Link className="button button-small" href={`/me/interfaces/${activeCloudId}`}>版本历史</Link></>}
        <button className="button button-small" type="button" onClick={() => importInput.current?.click()}>导入</button>
        <input ref={importInput} type="file" accept="application/json,.json" hidden onChange={importManifest} />
        <button className="button button-small" type="button" onClick={() => exportManifest("manifest")}>导出 JSON</button>
        <details className="export-menu"><summary className="button button-small">代码导出</summary><div>
          <button className="button button-small" type="button" onClick={() => exportManifest("python")}>Python</button>
          <button className="button button-small" type="button" onClick={() => exportManifest("typescript")}>TypeScript</button>
          <button className="button button-small" type="button" onClick={() => exportManifest("curl")}>cURL</button>
        </div></details>
        {canCloudSave && <button className="button button-small" type="button" onClick={() => setAiOpen(!aiOpen)}>AI Builder</button>}
        <button className="button button-small" type="button" onClick={() => { try { setRawText(JSON.stringify({ ...manifest, stateTemplate: JSON.parse(stateText) as unknown }, null, 2)); } catch { setRawText(JSON.stringify(manifest, null, 2)); } setRawOpen(!rawOpen); }}>Raw Manifest</button>
      </div>
    </header>
    {aiGenerated && <p className="notice ai-marker">AI-generated draft — please test before publishing</p>}
    {aiOpen && <AiBuilderPanel manifest={manifest} onApply={(candidate) => { setManifest(candidate); setStateText(JSON.stringify(candidate.stateTemplate, null, 2)); setAiGenerated(true); setStatus("AI 候选已应用到 Draft，请测试后保存或发布"); }} onClose={() => setAiOpen(false)} />}
    {rawOpen && <div className="raw-editor"><label className="field"><span>完整 Manifest JSON</span><textarea className="mono" rows={14} value={rawText} onChange={(event) => setRawText(event.target.value)} /></label><button className="button button-primary" type="button" onClick={applyRaw}>应用 Manifest</button></div>}
    {publishOpen && <div className="publish-panel" role="group" aria-label="发布设置"><h2>发布新版本</h2>
      <div className="field-row">
        <label className="field"><span>模型</span><select value={publishModel} onChange={(event) => setPublishModel(event.target.value)}>
          <option value="jev-1.13.0">jev-1.13.0 · 推荐固定版本</option><option value="jev-latest">jev-latest · 随上游更新</option>
          {!(["jev-1.13.0", "jev-latest"].includes(publishModel)) && <option value={publishModel}>{publishModel}</option>}
        </select></label>
        <label className="field"><span>可见性</span><select value={visibility} onChange={(event) => setVisibility(event.target.value as Visibility)}>
          <option value="private">Private · 仅自己</option><option value="unlisted">Unlisted · 知道链接的人</option><option value="public">Public · 所有人</option>
        </select></label>
      </div>
      <p className="field-hint">发布会创建不可修改的新快照。之后的编辑仍保存在 Draft。</p>
      <div className="dialog-actions"><button className="button" type="button" onClick={() => setPublishOpen(false)}>取消</button><button className="button button-primary" type="button" onClick={publish}>确认发布</button></div>
    </div>}
    <nav className="mobile-tabs" aria-label="Builder 工作区">
      {(["inputs", "questions", "test"] as const).map((item) => <button key={item} type="button" aria-pressed={tab === item} onClick={() => setTab(item)}>{item === "inputs" ? "Inputs / State" : item === "questions" ? "Questions" : "Test / Result"}</button>)}
    </nav>
    <div className="workspace">
      <div className={`workspace-panel ${tab === "inputs" ? "active" : ""}`}><div className="panel-title"><h2>Inputs / State</h2><span>01</span></div>
        <InputEditor inputs={manifest.inputs} onChange={handleInputs} />
        <div className="divider" />
        <section aria-labelledby="state-title"><div className="section-head"><h2 id="state-title">State Template</h2></div>
          <p className="field-hint">使用 <code>{'{"$input":"字段 ID"}'}</code> 引用输入。可选输入为空时，对应字段会省略。</p>
          <label className="field"><span>JSON 模板</span><textarea className="mono" rows={12} value={stateText} onChange={(event) => setStateText(event.target.value)} /></label>
        </section>
      </div>
      <div className={`workspace-panel ${tab === "questions" ? "active" : ""}`}><div className="panel-title"><h2>Questions</h2><span>02</span></div>
        <div className="section-head"><span className="field-hint">拖动卡片或使用方向按钮调整显示顺序。</span><div className="editor-card-actions">
          <button className="button button-small" type="button" onClick={() => addQuestion("noul")}>＋ Noul</button>
          <button className="button button-small" type="button" onClick={() => addQuestion("choice")}>＋ Choice</button>
          <button className="button button-small" type="button" onClick={() => addQuestion("score")}>＋ Score</button>
        </div></div>
        {manifest.resultView.order.map((id) => manifest.questions[id] && <QuestionEditor key={id} id={id} question={manifest.questions[id]}
          onRename={(nextId) => renameQuestion(id, nextId)}
          onChange={(question) => setManifest((current) => ({ ...current, questions: { ...current.questions, [id]: question } }))}
          onAdvancedSave={(value) => applyAdvancedQuestion(id, value)} onDuplicate={() => duplicateQuestion(id)} onRemove={() => removeQuestion(id)} onMove={(direction) => moveQuestion(id, direction)}
          onDragStart={() => { dragged.current = id; }} onDrop={() => { if (dragged.current) reorderQuestion(dragged.current, id); dragged.current = null; }} />)}
      </div>
      <div className={`workspace-panel ${tab === "test" ? "active" : ""}`}><RunPanel manifest={manifest} stateText={stateText} apiKey={apiKey} onOpenKey={() => setKeyOpen(true)} />
        <div className="divider" /><TestSuitePanel manifest={manifest} stateText={stateText} apiKey={apiKey} onOpenKey={() => setKeyOpen(true)} onChange={(examples) => setManifest((current) => ({ ...current, examples }))} /></div>
    </div>
    <div className="status-line" role="status" aria-live="polite">{status}</div>
    <CredentialDialog open={keyOpen} onClose={() => setKeyOpen(false)} apiKey={apiKey} onKeyChange={changeKey} rememberSession={remember} onRememberChange={changeRemember} onClear={clearKey} />
  </div>;
}
