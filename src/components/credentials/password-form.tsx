"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";

export function PasswordForm() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") || "");
    const password = String(data.get("password") || "");
    try {
      if (mode === "register") {
        const response = await fetch("/api/auth/register", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }),
        });
        if (!response.ok) {
          const result = await response.json();
          setError(result.error || "注册失败");
          return;
        }
      }
      const result = await signIn("credentials", { email, password, redirect: false, callbackUrl: "/me/interfaces" });
      if (!result || result.error) {
        setError(mode === "register" ? "注册成功，请登录" : "邮箱或密码错误");
      } else {
        window.location.assign(result.url || "/me/interfaces");
      }
    } catch {
      setError("服务暂不可用，请稍后重试");
    } finally {
      setBusy(false);
    }
  }

  return <div className="stack">
    <form className="stack" onSubmit={submit}>
      <label className="field"><span>邮箱</span><input type="email" name="email" autoComplete="email" required maxLength={320} /></label>
      <label className="field"><span>密码</span><input type="password" name="password" autoComplete={mode === "register" ? "new-password" : "current-password"} required minLength={mode === "register" ? 8 : undefined} maxLength={128} /></label>
      {error && <p role="alert" className="error">{error}</p>}
      <button className="button button-primary" type="submit" disabled={busy}>{busy ? "请稍候…" : mode === "register" ? "注册并登录" : "登录"}</button>
    </form>
    <button className="button button-quiet" type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
      {mode === "login" ? "没有账号？立即注册" : "已有账号？返回登录"}
    </button>
  </div>;
}
