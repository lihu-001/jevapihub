import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { describe, expect, it } from "vitest";
import * as schema from "../../src/db/schema";
import { createPasswordUser, findPasswordUser, normalizeEmail, validatePassword } from "../../src/lib/auth/password";

async function database() {
  const client = new PGlite();
  await client.exec("CREATE TABLE users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, email text UNIQUE, avatar_url text, role varchar(16) NOT NULL DEFAULT 'user', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());");
  await client.exec("CREATE TABLE password_accounts (user_id uuid PRIMARY KEY REFERENCES users(id), email text NOT NULL, password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()); CREATE UNIQUE INDEX password_accounts_email_unique ON password_accounts (lower(email));");
  return { client, db: drizzle(client, { schema }) };
}

describe("password authentication", () => {
  it("normalizes valid email and enforces password length", () => {
    expect(normalizeEmail(" Alice@Example.COM ")).toBe("alice@example.com");
    expect(normalizeEmail("invalid")).toBeNull();
    expect(validatePassword("1234567")).toBeNull();
    expect(validatePassword("12345678")).toBe("12345678");
  });

  it("stores a hash and authenticates only the matching password", async () => {
    const { client, db } = await database();
    try {
      const userId = await createPasswordUser(db, "alice@example.com", "correct horse battery staple");
      expect(await findPasswordUser(db, "alice@example.com", "wrong password")).toBeNull();
      expect(await findPasswordUser(db, "alice@example.com", "correct horse battery staple")).toBe(userId);
      const [account] = await db.select().from(schema.passwordAccounts);
      expect(account.passwordHash).not.toBe("correct horse battery staple");
    } finally { await client.close(); }
  });
});
