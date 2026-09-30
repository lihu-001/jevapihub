import { getDatabase } from "../../../../db/database";
import { createPasswordUser, normalizeEmail, validatePassword } from "../../../../lib/auth/password";
import { createWindowLimiter } from "../../../../lib/runtime/rate-limit";

const allowRegistration = createWindowLimiter();

export async function POST(request: Request) {
  if (!process.env.AUTH_SECRET || !process.env.DATABASE_URL) return Response.json({ error: "账号服务未配置" }, { status: 503 });
  const address = (request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("x-real-ip") || "unknown").trim().slice(0, 128);
  if (!allowRegistration(address, 5)) return Response.json({ error: "操作过于频繁，请稍后重试" }, { status: 429 });
  if (Number(request.headers.get("content-length")) > 4096) return Response.json({ error: "请求内容过大" }, { status: 413 });

  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "请求格式无效" }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "请求格式无效" }, { status: 400 });
  const values = body as Record<string, unknown>;
  const email = normalizeEmail(values.email);
  const password = validatePassword(values.password);
  if (!email || !password) return Response.json({ error: "请输入有效邮箱和 8–128 位密码" }, { status: 400 });
  try {
    await createPasswordUser(getDatabase(), email, password);
    return Response.json({ ok: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      return Response.json({ error: "该邮箱已注册" }, { status: 409 });
    }
    throw error;
  }
}
