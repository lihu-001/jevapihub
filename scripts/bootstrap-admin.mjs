import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

const DEFAULT_ADMIN_EMAIL = "admin@jev-interface.local";

export function adminEmail() {
  return (process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
}
export async function bootstrapAdmin(client, { password = process.env.ADMIN_PASSWORD } = {}) {
  const email = adminEmail();
  if (password && (password.length < 8 || password.length > 128)) throw new Error("ADMIN_PASSWORD must be 8–128 characters");
  const existing = await client.query("SELECT id, role FROM users WHERE email = $1", [email]);
  if (existing.rows.length) {
    if (existing.rows[0].role !== "admin") throw new Error("ADMIN_EMAIL belongs to a non-admin user");
    const account = await client.query("SELECT user_id FROM password_accounts WHERE user_id = $1", [existing.rows[0].id]);
    if (account.rows.length) return { email, password: null, created: false };
    throw new Error("ADMIN_EMAIL belongs to an admin without a password account");
  }
  const generatedPassword = password || randomBytes(18).toString("base64url");
  const passwordHash = await bcrypt.hash(generatedPassword, 12);
  const user = await client.query("INSERT INTO users(name, email, role) VALUES ('admin', $1, 'admin') RETURNING id", [email]);
  await client.query("INSERT INTO password_accounts(user_id, email, password_hash) VALUES ($1, $2, $3)", [user.rows[0].id, email, passwordHash]);
  return { email, password: password ? null : generatedPassword, created: true };
}
