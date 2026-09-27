export function RunAccess({ configured, onOpenKey }: { configured: boolean; onOpenKey: () => void }) {
  return <div className="run-access">
    <p>API Key 仅用于当前请求；运行不会单独保存输入或原始答案。</p>
    <button className="button button-small" type="button" onClick={onOpenKey}>{configured ? "更换 API Key" : "设置 API Key"}</button>
  </div>;
}
