import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "../../db/schema";

type Db<T extends PgQueryResultHKT> = PgDatabase<T, typeof schema>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 320 && emailPattern.test(email) ? email : null;
}

export function validatePassword(value: unknown): string | null {
  if (typeof value !== "string" || value.length < MIN_PASSWORD_LENGTH || value.length > 128) return null;
  return value;
}

export async function findPasswordUser<T extends PgQueryResultHKT>(db: Db<T>, email: string, password: string) {
  const [account] = await db.select({ userId: schema.passwordAccounts.userId, passwordHash: schema.passwordAccounts.passwordHash })
    .from(schema.passwordAccounts).where(sql`lower(${schema.passwordAccounts.email}) = ${email}`).limit(1);
  if (!account || !(await bcrypt.compare(password, account.passwordHash))) return null;
  return account.userId;
}

export async function createPasswordUser<T extends PgQueryResultHKT>(db: Db<T>, email: string, password: string, name?: string) {
  const passwordHash = await bcrypt.hash(password, 12);
  return db.transaction(async (tx) => {
    const [user] = await tx.insert(schema.users).values({ email, name: name?.trim() || email.split("@")[0] }).returning({ id: schema.users.id });
    await tx.insert(schema.passwordAccounts).values({ userId: user.id, email, passwordHash });
    return user.id;
  });
}
