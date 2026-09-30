"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createBuilderDefaultManifest } from "../../lib/manifest/starter";
import { prepareBuilderRequest, prepareEditedRequest } from "../../lib/manifest/builder-request";
import { formatSimpleState, simplifyManifest } from "../../lib/manifest/simple-builder";
import type { Manifest, Question } from "../../lib/manifest/types";
import { ManifestValidationError, parseManifest } from "../../lib/manifest/validate";
import { CredentialDialog } from "../credentials/credential-dialog";
import { InputControl } from "./run-panel";
import { SimpleRunPanel } from "./simple-run-panel";

const DRAFT_KEY = "jev-interface-local-draft-v2";
const LEGACY_DRAFT_KEY = "jev-interface-local-draft";
const SESSION_KEY = "jev-typesafe-session-key";
const QUESTION_ID = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;
type Visibility = "private" | "unlisted" | "public";

function issueMessage(error: unknown) {
  if (error instanceof ManifestValidationError) return error.issues.join("；");
  return error instanceof Error ? error.message : "操作失败";
}

function formatQuestionDrafts(manifest: Manifest): Record<string, string> {
  return Object.fromEntries(Object.entries(manifest.questions).map(([id, question]) => [id, JSON.stringify(question, null, 2)]));
}

function formatRequestJson(manifest: Manifest, stateText: string, questionError = "") {
  return JSON.stringify(prepareBuilderRequest(manifest, stateText, questionError).request, null, 2);
}

function readQuestionDraft(id: string, text: string): Question {
  const starter = createBuilderDefaultManifest();
  const value: unknown = JSON.parse(text);
  return parseManifest({
    ...starter,
    questions: { [id]: value },
    resultView: { ...starter.resultView, order: [id] },
  }).questions[id];
}

export function Builder({ initialManifest, cloudId, canCloudSave = false, canPublish = false, initialVisibility = "private", initialAiGenerated = false }: {
  initialManifest?: Manifest; cloudId?: string; canCloudSave?: boolean; canPublish?: boolean; initialVisibility?: Visibility; initialAiGenerated?: boolean;
}) {
  const router = useRouter();
  const [manifest, setManifest] = useState<Manifest>(() => simplifyManifest(initialManifest ?? createBuilderDefaultManifest()));
  const [stateText, setStateText] = useState(() => formatSimpleState(simplifyManifest(initialManifest ?? createBuilderDefaultManifest()).stateTemplate));
  const [questionDrafts, setQuestionDrafts] = useState(() => formatQuestionDrafts(simplifyManifest(initialManifest ?? createBuilderDefaultManifest())));
  const [questionErrors, setQuestionErrors] = useState<Record<string, string>>({});
  const [activeCloudId, setActiveCloudId] = useState(cloudId);
  const [visibility, setVisibility] = useState<Visibility>(initialVisibility);
  const [publishOpen, setPublishOpen] = useState(false);
  const saveDialog = useRef<HTMLDialogElement>(null);
  const [saveTarget, setSaveTarget] = useState<"local" | "cloud" | null>(null);
  const [saveTitle, setSaveTitle] = useState("");
  const [saveDescription, setSaveDescription] = useState("");
  const [saveError, setSaveError] = useState("");
  const [publishModel, setPublishModel] = useState(manifest.runtime.model);
  const [apiKey, setApiKey] = useState("");
  const [remember, setRemember] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);
  const [tab, setTab] = useState<"state" | "questions" | "result">("state");
  const [mode, setMode] = useState<"basic" | "professional">("basic");
  const [professionalJson, setProfessionalJson] = useState("");
  const [status, setStatus] = useState("");
  const [revision, setRevision] = useState(0);
  const [legacyDraftAvailable, setLegacyDraftAvailable] = useState(false);
  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const savedKey = sessionStorage.getItem(SESSION_KEY);
        if (savedKey) { setApiKey(savedKey); setRemember(true); }
        const saved = cloudId ? null : localStorage.getItem(DRAFT_KEY);
        const legacy = cloudId ? null : localStorage.getItem(LEGACY_DRAFT_KEY);
        if (legacy) setLegacyDraftAvailable(true);
        if (saved) {
          const parsed = simplifyManifest(parseManifest(JSON.parse(saved) as unknown));
          setManifest(parsed);
          setStateText(formatSimpleState(parsed.stateTemplate));
          setQuestionDrafts(formatQuestionDrafts(parsed));
          setProfessionalJson(formatRequestJson(parsed, formatSimpleState(parsed.stateTemplate)));
          setQuestionErrors({});
          setStatus("已载入本机草稿");
        } else if (legacy) setStatus("已显示新的默认示例；旧版草稿可手动恢复");
      } catch { setStatus("本机草稿无法读取，可继续新建"); }
      finally { setDraftReady(true); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [cloudId]);
  useEffect(() => {
    if (saveTarget && !saveDialog.current?.open) saveDialog.current?.showModal();
    if (!saveTarget && saveDialog.current?.open) saveDialog.current.close();
  }, [saveTarget]);

  function openSave(target: "local" | "cloud") {
    setSaveTitle(manifest.metadata.name === "新建 Interface" && !activeCloudId ? "" : manifest.metadata.name);
    setSaveDescription(manifest.metadata.description);
    setSaveError("");
    setSaveTarget(target);
  }
  function closeSave() { setSaveTarget(null); setSaveError(""); }
  function savedManifest() {
    const name = saveTitle.trim();
    if (!name) throw new Error("请填写标题");
    return parseManifest({ ...currentManifest(), metadata: { ...manifest.metadata, name, description: saveDescription.trim() } });
  }

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
  function currentManifest() {
    if (mode === "professional") return prepareEditedRequest(professionalJson, manifest).prepared;
    const invalidId = Object.keys(questionErrors)[0];
    if (invalidId) throw new Error(`${invalidId} JSON 无效：${questionErrors[invalidId]}`);
    return prepareBuilderRequest(manifest, stateText, "").prepared;
  }
  function switchMode(nextMode: "basic" | "professional") {
    if (!draftReady || nextMode === mode) return;
    try {
      if (nextMode === "professional") {
        const questionError = Object.entries(questionErrors)[0]?.join(" JSON 无效：") ?? "";
        setProfessionalJson(formatRequestJson(manifest, stateText, questionError));
      } else {
        const { prepared } = prepareEditedRequest(professionalJson, manifest);
        const editable = simplifyManifest(prepared);
        setManifest(editable);
        setStateText(formatSimpleState(editable.stateTemplate));
        setQuestionDrafts(formatQuestionDrafts(editable));
        setQuestionErrors({});
        setRevision((current) => current + 1);
      }
      setStatus("");
      setMode(nextMode);
    } catch (error) { setStatus(issueMessage(error)); }
  }
  function changeState(value: string) { setStateText(value); setRevision((current) => current + 1); }
  function changeQuestion(id: string, text: string) {
    setQuestionDrafts((current) => ({ ...current, [id]: text }));
    try {
      const question = readQuestionDraft(id, text);
      setQuestionErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== id)));
      setManifest((current) => ({ ...current, questions: { ...current.questions, [id]: question } }));
      setRevision((current) => current + 1);
    } catch (error) {
      setQuestionErrors((current) => ({ ...current, [id]: issueMessage(error) }));
    }
  }
  function renameQuestion(id: string, nextId: string): boolean {
    if (!QUESTION_ID.test(nextId) || (nextId !== id && Object.hasOwn(manifest.questions, nextId))) {
      setStatus("Question ID 必须唯一，且以字母开头，只能包含字母、数字、_、-");
      return false;
    }
    if (nextId === id) return true;
    setManifest((current) => ({
      ...current,
      questions: Object.fromEntries(Object.entries(current.questions).map(([key, value]) => [key === id ? nextId : key, value])),
      resultView: { ...current.resultView, order: current.resultView.order.map((key) => key === id ? nextId : key) },
      postprocess: current.postprocess?.kind === "weighted_score"
        ? { ...current.postprocess, metrics: current.postprocess.metrics.map((metric) => ({ ...metric, sources: metric.sources.map((source) => source.questionId === id ? { ...source, questionId: nextId } : source) })) }
        : current.postprocess,
      examples: current.examples?.map((example) => ({
        ...example,
        expectations: example.expectations && Object.fromEntries(Object.entries(example.expectations).map(([key, value]) => [key.startsWith(id + ".") ? nextId + key.slice(id.length) : key, value])),
      })),
    }));
    setQuestionDrafts((current) => Object.fromEntries(Object.entries(current).map(([key, value]) => [key === id ? nextId : key, value])));
    setQuestionErrors((current) => Object.fromEntries(Object.entries(current).map(([key, value]) => [key === id ? nextId : key, value])));
    setRevision((current) => current + 1);
    setStatus("已更新 Question ID");
    return true;
  }
  function addQuestion(type: Question["type"]) {
    let count = 1;
    while (Object.hasOwn(manifest.questions, "question_" + count)) count++;
    const id = "question_" + count;
    const question: Question = type === "noul" ? { type, instructions: "" }
      : type === "choice" ? { type, instructions: "", criteria: { option_a: "选项 A", option_b: "选项 B" } }
        : { type, instructions: "", criteria: ["低", "高"] };
    setManifest((current) => ({ ...current, questions: { ...current.questions, [id]: question }, resultView: { ...current.resultView, order: [...current.resultView.order, id] } }));
    setQuestionDrafts((current) => ({ ...current, [id]: JSON.stringify(question, null, 2) }));
    setRevision((current) => current + 1);
  }
  function removeQuestion(id: string) {
    setManifest((current) => ({
      ...current,
      questions: Object.fromEntries(Object.entries(current.questions).filter(([key]) => key !== id)),
      resultView: { ...current.resultView, order: current.resultView.order.filter((key) => key !== id) },
      postprocess: current.postprocess?.kind === "weighted_score"
        ? { ...current.postprocess, metrics: current.postprocess.metrics.map((metric) => ({ ...metric, sources: metric.sources.filter((source) => source.questionId !== id) })).filter((metric) => metric.sources.length > 0) }
        : current.postprocess,
      examples: current.examples?.map((example) => ({
        ...example,
        expectations: Object.fromEntries(Object.entries(example.expectations ?? {}).filter(([key]) => !key.startsWith(id + "."))),
      })),
    }));
    setQuestionDrafts((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== id)));
    setQuestionErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== id)));
    setRevision((current) => current + 1);
  }
  function saveLocal() {
    try {
      const value = savedManifest();
      localStorage.setItem(DRAFT_KEY, JSON.stringify(value));
      setManifest((current) => ({ ...current, metadata: value.metadata }));
      closeSave();
      setStatus("已保存到本机浏览器");
    } catch (error) { setSaveError(issueMessage(error)); }
  }
  function restoreLegacyDraft() {
    try {
      const saved = localStorage.getItem(LEGACY_DRAFT_KEY);
      if (!saved) throw new Error("未找到旧版草稿");
      const parsed = simplifyManifest(parseManifest(JSON.parse(saved) as unknown));
      localStorage.setItem(DRAFT_KEY, JSON.stringify(prepareBuilderRequest(parsed, formatSimpleState(parsed.stateTemplate), "").prepared));
      setManifest(parsed);
      setStateText(formatSimpleState(parsed.stateTemplate));
      setQuestionDrafts(formatQuestionDrafts(parsed));
      setQuestionErrors({});
      setRevision((current) => current + 1);
      setLegacyDraftAvailable(false);
      setMode("basic");
      setStatus("已恢复旧版草稿");
    } catch (error) { setStatus(issueMessage(error)); }
  }
  async function cloudRequest(path: string, method: string, body: unknown) {
    const response = await fetch(path, { method, cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json() as { interface?: { id: string }; version?: { versionNumber: number }; error?: { message?: string } };
    if (!response.ok) throw new Error(data.error?.message ?? "云端操作失败");
    return data;
  }
  async function saveCloud() {
    try {
      const value = savedManifest();
      if (activeCloudId) {
        await cloudRequest("/api/interfaces/" + activeCloudId + "/draft", "PUT", { manifest: value, aiGenerated: initialAiGenerated });
        setStatus("Draft 已保存到云端");
      } else {
        const cloudManifest = value.metadata.slug === "new-interface"
          ? { ...value, metadata: { ...value.metadata, slug: `new-interface-${crypto.randomUUID()}` } }
          : value;
        const created = await cloudRequest("/api/interfaces", "POST", { manifest: cloudManifest, aiGenerated: initialAiGenerated });
        const id = created.interface?.id;
        if (!id) throw new Error("云端创建失败");
        setActiveCloudId(id);
        setStatus("Interface 已创建，Draft 已保存到云端");
        router.replace("/builder/" + id);
      }
      setManifest((current) => ({ ...current, metadata: value.metadata }));
      closeSave();
    } catch (error) { setSaveError(issueMessage(error)); }
  }
  async function publish() {
    if (!activeCloudId) return;
    try {
      const value = currentManifest();
      const publishedDraft = { ...value, runtime: { ...value.runtime, model: publishModel } };
      await cloudRequest("/api/interfaces/" + activeCloudId + "/draft", "PUT", { manifest: publishedDraft, aiGenerated: initialAiGenerated });
      const result = await cloudRequest("/api/interfaces/" + activeCloudId + "/publish", "POST", { visibility });
      const editable = simplifyManifest(publishedDraft);
      setManifest(editable);
      setStateText(formatSimpleState(editable.stateTemplate));
      if (mode === "professional") setProfessionalJson(formatRequestJson(editable, formatSimpleState(editable.stateTemplate)));
      setPublishOpen(false);
      setStatus("已发布 v" + (result.version?.versionNumber ?? "?"));
      router.refresh();
    } catch (error) { setStatus(issueMessage(error)); }
  }
  function openPublish() {
    try { setPublishModel(currentManifest().runtime.model); setPublishOpen(true); }
    catch (error) { setStatus(issueMessage(error)); }
  }

  let publishPreview: Manifest | null = null;
  let publishPreviewError = "";
  if (publishOpen) {
    try { publishPreview = currentManifest(); }
    catch (error) { publishPreviewError = issueMessage(error); }
  }

  return <div className="builder-shell">
    <header className="builder-header">
      <Link className="brand" href="/">Jev / Interface Hub</Link>
      <input className="name-input" aria-label="Interface 名称" value={manifest.metadata.name} onChange={(event) => setManifest((current) => ({ ...current, metadata: { ...current.metadata, name: event.target.value } }))} />
      <div className="header-actions">
        <Link className="button button-small" href="/hub">前往 Hub</Link>
        <button className="button button-small" type="button" onClick={() => openSave("local")}>保存到本机</button>
        {legacyDraftAvailable && <button className="button button-small" type="button" onClick={restoreLegacyDraft}>恢复旧草稿</button>}
        {canCloudSave ? <button className="button button-small" type="button" onClick={() => openSave("cloud")}>保存到云端</button>
          : <Link className="button button-small" href="/login">登录后云端保存</Link>}
        {activeCloudId && canPublish && <><button className="button button-small button-primary" type="button" onClick={openPublish}>发布版本</button>
          <Link className="button button-small" href={"/me/interfaces/" + activeCloudId}>版本历史</Link></>}
        {activeCloudId && !canPublish && <Link className="button button-small" href={"/me/interfaces/" + activeCloudId}>我的 Interface</Link>}
        <button className="button button-small builder-key-button" type="button" onClick={() => setKeyOpen(true)}>{apiKey ? "更换 API Key" : "设置 API Key"}</button>
      </div>
    </header>
    <dialog ref={saveDialog} className="credential-dialog" onCancel={closeSave} onClose={closeSave} aria-labelledby="save-title">
      <h2 id="save-title">{saveTarget === "cloud" ? "保存到云端" : "保存到本机"}</h2>
      <form onSubmit={(event) => { event.preventDefault(); if (saveTarget === "local") saveLocal(); else if (saveTarget === "cloud") void saveCloud(); }}>
        <div className="stack">
          <label className="field"><span>标题（必填）</span><input value={saveTitle} onChange={(event) => setSaveTitle(event.target.value)} maxLength={120} required autoFocus /></label>
          <label className="field"><span>描述（选填）</span><textarea value={saveDescription} onChange={(event) => setSaveDescription(event.target.value)} maxLength={2000} /></label>
        </div>
        {saveError && <p className="error" role="alert">{saveError}</p>}
        <div className="dialog-actions"><button className="button" type="button" onClick={closeSave}>取消</button><button className="button button-primary" type="submit">确认保存</button></div>
      </form>
    </dialog>
    {canPublish && publishOpen && <div className="publish-panel" role="group" aria-label="发布设置"><h2>发布新版本</h2>
      <div className="field-row">
        <label className="field"><span>模型</span><select value={publishModel} onChange={(event) => setPublishModel(event.target.value)}>
          <option value="jev-1.13.0">jev-1.13.0 · 固定版本</option><option value="jev-latest">jev-latest · 随上游更新</option>
          {!["jev-1.13.0", "jev-latest"].includes(publishModel) && <option value={publishModel}>{publishModel}</option>}
        </select></label>
        <label className="field"><span>可见性</span><select value={visibility} onChange={(event) => setVisibility(event.target.value as Visibility)}>
          <option value="private">Private · 仅自己</option><option value="unlisted">Unlisted · 知道链接的人</option><option value="public">Public · 所有人</option>
        </select></label>
      </div>
      <div className="publish-preview"><h3>Hub 试运行预览</h3>
        <p className="field-hint">下面的示例会随版本保存，并在 Hub 表单中预填；访客可替换内容。模型和 Questions 使用本次发布的版本。</p>
        {publishPreview?.inputs.map((input) => <InputControl key={input.id} input={input} disabled onChange={() => {}} />)}
        {publishPreviewError && <p className="error" role="alert">{publishPreviewError}</p>}
      </div>
      <div className="dialog-actions"><button className="button" type="button" onClick={() => setPublishOpen(false)}>取消</button><button className="button button-primary" type="button" disabled={!!publishPreviewError} onClick={publish}>确认发布</button></div>
    </div>}
    <nav className="builder-mode-switch" aria-label="编辑模式">
      <button type="button" aria-pressed={mode === "basic"} disabled={!draftReady} onClick={() => switchMode("basic")}>基础模式</button>
      <button type="button" aria-pressed={mode === "professional"} disabled={!draftReady} onClick={() => switchMode("professional")}>JSON 调试</button>
    </nav>
    {mode === "basic" && <><nav className="mobile-tabs" aria-label="Builder 工作区">
      {(["state", "questions", "result"] as const).map((item) => <button key={item} type="button" aria-pressed={tab === item} onClick={() => setTab(item)}>{item === "state" ? "State" : item === "questions" ? "Questions" : "结果"}</button>)}
    </nav>
    <main className="workspace">
      <section className={"workspace-panel " + (tab === "state" ? "active" : "")} aria-labelledby="state-title">
        <div className="panel-title"><h2 id="state-title">State</h2><span>01</span></div>
        <p className="field-hint">这里填写试运行示例。发布后，访客可输入自己的内容；支持普通文本、JSON 字符串、对象或数组。</p>
        <label className="field"><span className="visually-hidden">State 内容</span><textarea className="mono simple-state-input" value={stateText} onChange={(event) => changeState(event.target.value)} placeholder="在这里输入 State" /></label>
      </section>
      <section className={"workspace-panel " + (tab === "questions" ? "active" : "")} aria-labelledby="questions-title">
        <div className="panel-title"><h2 id="questions-title">Questions</h2><span>02</span></div>
        <div className="question-add-actions">
          <button className="button button-small" type="button" onClick={() => addQuestion("noul")}>＋ Noul</button>
          <button className="button button-small" type="button" onClick={() => addQuestion("choice")}>＋ Choice</button>
          <button className="button button-small" type="button" onClick={() => addQuestion("score")}>＋ Score</button>
        </div>
        <div className="simple-questions">
          {manifest.resultView.order.map((id) => {
            const question = manifest.questions[id];
            if (!question) return null;
            return <article className="simple-question" key={id}>
              <div className="editor-card-header"><div className="question-card-title"><strong>{question.type.toUpperCase()} ·</strong>
                <QuestionIdInput id={id} onRename={(nextId) => renameQuestion(id, nextId)} /></div>
                <button className="button button-small button-danger" type="button" disabled={manifest.resultView.order.length === 1} onClick={() => removeQuestion(id)} aria-label={"删除 " + id}>删除</button></div>
              <label className="field"><span className="visually-hidden">{id} JSON</span><textarea className="mono question-json-input" rows={12} value={questionDrafts[id] ?? JSON.stringify(question, null, 2)}
                aria-invalid={!!questionErrors[id]} onChange={(event) => changeQuestion(id, event.target.value)} /></label>
              {questionErrors[id] && <p className="error" role="alert">{id} JSON 无效：{questionErrors[id]}</p>}
            </article>;
          })}
        </div>
      </section>
      <section className={"workspace-panel " + (tab === "result" ? "active" : "")} aria-labelledby="run-title">
        <SimpleRunPanel key={revision} manifest={manifest} stateText={stateText} questionError={Object.entries(questionErrors)[0]?.join(" JSON 无效：") ?? ""} apiKey={apiKey} onOpenKey={() => setKeyOpen(true)} onOpenJsonDebug={() => switchMode("professional")} />
      </section>
    </main></>}
    {mode === "professional" && <main className="workspace workspace-professional">
      <section className="workspace-panel professional-input-panel" aria-labelledby="professional-json-title">
        <div className="panel-title"><h2 id="professional-json-title">请求 JSON</h2><span>01</span></div>
        <p id="professional-json-hint" className="field-hint">编辑 state、model 和 questions，运行后查看右侧结果。</p>
        <label className="field"><span className="visually-hidden">请求 JSON</span><textarea className="mono professional-json-editor" value={professionalJson} onChange={(event) => setProfessionalJson(event.target.value)} aria-describedby="professional-json-hint" spellCheck={false} /></label>
      </section>
      <section className="workspace-panel professional-result-panel" aria-labelledby="run-title">
        <SimpleRunPanel key={professionalJson} manifest={manifest} stateText={stateText} questionError="" apiKey={apiKey} onOpenKey={() => setKeyOpen(true)} professionalJson={professionalJson} />
      </section>
    </main>}
    <div className="status-line" role="status" aria-live="polite">{status}</div>
    <CredentialDialog open={keyOpen} onClose={() => setKeyOpen(false)} apiKey={apiKey} onKeyChange={changeKey} rememberSession={remember} onRememberChange={changeRemember} onClear={clearKey} />
  </div>;
}

function QuestionIdInput({ id, onRename }: { id: string; onRename: (nextId: string) => boolean }) {
  const [draft, setDraft] = useState(id);
  function commit() {
    if (draft !== id && !onRename(draft)) setDraft(id);
  }
  return <label className="question-id-label"><span className="visually-hidden">Question ID</span>
    <input className="mono question-id-input" aria-label={id + " ID"} value={draft} maxLength={64}
      onChange={(event) => setDraft(event.target.value)} onBlur={commit}
      onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { setDraft(id); event.currentTarget.blur(); } }} />
  </label>;
}
