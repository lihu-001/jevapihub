"use client";

import { signIn } from "next-auth/react";

export function LoginButtons({ github, google }: { github: boolean; google: boolean }) {
  return <div className="stack">
    {github && <button className="button button-primary" type="button" onClick={() => signIn("github", { callbackUrl: "/me/interfaces" })}>使用 GitHub 登录</button>}
    {google && <button className="button" type="button" onClick={() => signIn("google", { callbackUrl: "/me/interfaces" })}>使用 Google 登录</button>}
    {!github && !google && <p role="status" className="notice">登录功能尚未配置 OAuth 应用。请在服务器设置 GitHub 或 Google 的客户端凭据。</p>}
  </div>;
}
