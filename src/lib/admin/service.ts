import { and, desc, eq, or, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "../../db/schema";
import { InterfaceError } from "../interfaces/service";

type Db<T extends PgQueryResultHKT> = PgDatabase<T, typeof schema>;

function rowsOf<T>(result: unknown): T[] {
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) return result.rows as T[];
  if (Array.isArray(result)) return result as T[];
  throw new Error("Unexpected database result");
}

export function createAdminService<T extends PgQueryResultHKT>(db: Db<T>) {
  async function requireAdmin(userId: string) {
    const [user] = await db.select({ role: schema.users.role }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    if (user?.role !== "admin") throw new InterfaceError("FORBIDDEN", 403);
  }
  return {
    async listInterfaces(adminId: string) {
      await requireAdmin(adminId);
      return db.select({ id: schema.interfaces.id, name: schema.interfaces.name, slug: schema.interfaces.slug,
        ownerId: schema.interfaces.ownerId, ownerName: schema.users.name, category: schema.interfaces.category,
        status: schema.interfaces.status, featured: schema.interfaces.featured, adminHidden: schema.interfaces.adminHidden, updatedAt: schema.interfaces.updatedAt,
      }).from(schema.interfaces).innerJoin(schema.users, eq(schema.users.id, schema.interfaces.ownerId))
        .where(or(and(eq(schema.interfaces.ownerId, adminId), eq(schema.interfaces.status, "draft")),
          and(eq(schema.interfaces.status, "published"), eq(schema.interfaces.visibility, "public")), eq(schema.interfaces.adminHidden, true)))
        .orderBy(desc(schema.interfaces.updatedAt)).limit(100);
    },
    async overview(adminId: string) {
      await requireAdmin(adminId);
      return rowsOf<{ totalRuns: number; successRuns: number; avgLatencyMs: number; inputTokens: number; outputTokens: number }>(await db.execute(sql`
        SELECT count(*)::integer AS "totalRuns", count(*) FILTER (WHERE success)::integer AS "successRuns",
          COALESCE(round(avg(latency_ms)), 0)::integer AS "avgLatencyMs",
          COALESCE(sum(input_tokens), 0)::integer AS "inputTokens",
          COALESCE(sum(output_tokens), 0)::integer AS "outputTokens"
        FROM run_events
      `))[0];
    },
    async setHidden(id: string, adminId: string, hidden: boolean) {
      await requireAdmin(adminId);
      const [project] = await db.select().from(schema.interfaces).where(eq(schema.interfaces.id, id)).limit(1);
      if (!project || !project.publishedVersionId || (!hidden && !project.adminHidden) || (hidden && (project.status !== "published" || project.visibility !== "public"))) {
        throw new InterfaceError("INTERFACE_NOT_FOUND", 404);
      }
      await db.update(schema.interfaces).set({ status: hidden ? "archived" : "published", visibility: hidden ? "private" : "public",
        featured: false, adminHidden: hidden, updatedAt: new Date(),
      }).where(eq(schema.interfaces.id, id));
    },
    async categories(adminId: string) {
      await requireAdmin(adminId);
      return db.select().from(schema.hubCategories).orderBy(schema.hubCategories.sortOrder, schema.hubCategories.slug);
    },
    async upsertCategory(adminId: string, category: { slug: string; name: string; enabled: boolean; sortOrder: number }) {
      await requireAdmin(adminId);
      await db.insert(schema.hubCategories).values(category).onConflictDoUpdate({ target: schema.hubCategories.slug,
        set: { name: category.name, enabled: category.enabled, sortOrder: category.sortOrder },
      });
    },
    async removeCategory(adminId: string, slug: string) {
      await requireAdmin(adminId);
      await db.delete(schema.hubCategories).where(eq(schema.hubCategories.slug, slug));
    },
  };
}
