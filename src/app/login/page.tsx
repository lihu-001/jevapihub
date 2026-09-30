import Link from "next/link";
import { redirect } from "next/navigation";
import { PasswordForm } from "../../components/credentials/password-form";
import { getCurrentUserId } from "../../lib/auth/current-user";

export default async function LoginPage() {
  if (await getCurrentUserId()) redirect("/me/interfaces");
  return <main className="content-page"><nav><Link href="/">← Jev Interface Hub</Link></nav>
    <section className="login-card"><span className="eyebrow">ACCOUNT</span><h1>登录后保存你的 Interface</h1>
      <p className="muted">登录用于云端 Draft、版本和发布。TypeSafe API Key 始终由你自己提供，不会写入账号。</p>
      <PasswordForm />
      <p className="field-hint">只想试运行？<Link href="/builder/new">无需登录，打开 Builder</Link></p>
    </section>
  </main>;
}
