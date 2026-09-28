"use client";

import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  apiKey: string;
  onKeyChange: (key: string) => void;
  rememberSession: boolean;
  onRememberChange: (remember: boolean) => void;
  onClear: () => void;
};

export function CredentialDialog({ open, onClose, apiKey, onKeyChange, rememberSession, onRememberChange, onClear }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);
  return <dialog ref={dialog} className="credential-dialog" onClose={onClose} onCancel={onClose} aria-labelledby="credential-title">
    <div className="credential-dialog-header">
      <h2 id="credential-title">TypeSafe API Key</h2>
      <button className="credential-dialog-close" type="button" aria-label="关闭" onClick={onClose}>×</button>
    </div>
    <p className="muted">Key 仅用于当前请求，不保存至账号或数据库，也不写入应用日志。默认只保留在当前页面内存。</p>
    <div className="stack">
      <label className="field" htmlFor="typesafe-key"><span>你的 API Key</span>
        <input id="typesafe-key" type="password" value={apiKey} onChange={(event) => onKeyChange(event.target.value)} autoComplete="off" spellCheck={false} autoFocus />
      </label>
      <label className="checkline"><input type="checkbox" checked={rememberSession} onChange={(event) => onRememberChange(event.target.checked)} />在当前浏览器会话中记住</label>
    </div>
    <div className="dialog-actions">
      <button className="button button-quiet" type="button" onClick={onClear}>清除 Key</button>
      <button className="button button-primary" type="button" onClick={onClose}>完成</button>
    </div>
  </dialog>;
}
