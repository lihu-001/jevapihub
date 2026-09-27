"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return <button className="button button-small" type="button" onClick={() => signOut({ callbackUrl: "/" })}>退出登录</button>;
}
