import { and, eq } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "../../db/schema";

type Db<T extends PgQueryResultHKT> = PgDatabase<T, typeof schema>;

export async function findOAuthUser<T extends PgQueryResultHKT>(db: Db<T>, provider: string, providerAccountId: string): Promise<string | null> {
  const [account] = await db.select({ userId: schema.oauthAccounts.userId }).from(schema.oauthAccounts)
    .where(and(eq(schema.oauthAccounts.provider, provider), eq(schema.oauthAccounts.providerAccountId, providerAccountId))).limit(1);
  return account?.userId ?? null;
}

export async function ensureOAuthUser<T extends PgQueryResultHKT>(
  db: Db<T>, provider: string, providerAccountId: string,
  profile: { name?: string | null; email?: string | null; image?: string | null },
): Promise<string | null> {
  const existing = await findOAuthUser(db, provider, providerAccountId);
  if (existing) return existing;
  // An email shared with another provider must be linked explicitly by an authenticated user.
  if (profile.email) {
    const [conflict] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, profile.email)).limit(1);
    if (conflict) return null;
  }
  try {
    return await db.transaction(async (tx) => {
      const [user] = await tx.insert(schema.users).values({ name: profile.name, email: profile.email, avatarUrl: profile.image }).returning({ id: schema.users.id });
      await tx.insert(schema.oauthAccounts).values({ provider, providerAccountId, userId: user.id });
      return user.id;
    });
  } catch (error) {
    // Concurrent first sign-ins can race on the provider identity.
    const raced = await findOAuthUser(db, provider, providerAccountId);
    if (raced) return raced;
    throw error;
  }
}
