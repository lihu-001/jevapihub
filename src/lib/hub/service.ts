import { and, eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "../../db/schema";
import { InterfaceError } from "../interfaces/service";
import { parseManifest } from "../manifest/validate";

type Db<T extends PgQueryResultHKT> = PgDatabase<T, typeof schema>;

export type HubSort = "latest" | "runs" | "featured";
export type HubFilters = { search?: string; category?: string; tag?: string; language?: string; sort?: HubSort; featured?: boolean; page?: number };
export type HubCard = { id: string; ownerId: string; ownerName: string | null; slug: string; name: string; description: string;
  category: string; language: string; featured: boolean; versionId: string; versionNumber: number; model: string;
  tags: string[]; runCount: number; updatedAt: Date };

function rowsOf<T>(result: unknown): T[] {
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) return result.rows as T[];
  if (Array.isArray(result)) return result as T[];
  throw new Error("Unexpected database result");
}

export function createHubService<T extends PgQueryResultHKT>(db: Db<T>) {

  return {
    async list(filters: HubFilters = {}): Promise<HubCard[]> {
      const sort = filters.sort ?? "featured";
      const order = sort === "runs" ? sql`COALESCE(r.run_count, 0) DESC, v.published_at DESC`
        : sort === "latest" ? sql`v.published_at DESC`
          : sql`i.featured DESC, v.published_at DESC`;
      const page = Math.max(1, Math.min(1000, Math.floor(filters.page || 1)));
      const result = await db.execute(sql`
        SELECT i.id, i.owner_id AS "ownerId", u.name AS "ownerName",
          v.manifest_json->'metadata'->>'slug' AS slug,
          v.manifest_json->'metadata'->>'name' AS name,
          v.manifest_json->'metadata'->>'description' AS description,
          v.manifest_json->'metadata'->>'category' AS category,
          v.manifest_json->'metadata'->>'language' AS language,
          i.featured, v.id AS "versionId", v.version_number AS "versionNumber",
          v.manifest_json->'runtime'->>'model' AS model,
          COALESCE(v.manifest_json->'metadata'->'tags', '[]'::jsonb) AS tags,
          COALESCE(r.run_count, 0)::integer AS "runCount", v.published_at AS "updatedAt"
        FROM interfaces i
        JOIN users u ON u.id = i.owner_id
        JOIN interface_versions v ON v.id = i.published_version_id
        LEFT JOIN (SELECT interface_id, count(*) AS run_count FROM run_events WHERE success = true GROUP BY interface_id) r ON r.interface_id = i.id
        WHERE i.status = 'published' AND i.visibility = 'public'
          AND (${filters.search?.trim() || ""} = '' OR position(lower(${filters.search?.trim() || ""}) in lower(
            (v.manifest_json->'metadata'->>'name') || ' ' || (v.manifest_json->'metadata'->>'description'))) > 0)
          AND (${filters.category || ""} = '' OR v.manifest_json->'metadata'->>'category' = ${filters.category || ""})
          AND (${filters.language || ""} = '' OR v.manifest_json->'metadata'->>'language' = ${filters.language || ""})
          AND (${filters.tag || ""} = '' OR COALESCE(v.manifest_json->'metadata'->'tags', '[]'::jsonb) @> jsonb_build_array(${filters.tag || ""}::text))
          AND (${!!filters.featured} = false OR i.featured = true)
        ORDER BY ${order}
        LIMIT 24 OFFSET ${(page - 1) * 24}
      `);
      return rowsOf<HubCard>(result);
    },
    async detail(ownerId: string, slug: string, viewerId: string | null) {
      const [record] = await db.select({ project: schema.interfaces, version: schema.interfaceVersions }).from(schema.interfaces)
        .innerJoin(schema.interfaceVersions, eq(schema.interfaceVersions.id, schema.interfaces.publishedVersionId))
        .where(and(eq(schema.interfaces.ownerId, ownerId), sql`${schema.interfaceVersions.manifestJson}->'metadata'->>'slug' = ${slug}`)).limit(1);
      const project = record?.project;
      if (!project || project.status !== "published" || (project.visibility === "private" && project.ownerId !== viewerId)) {
        throw new InterfaceError("INTERFACE_NOT_FOUND", 404);
      }
      const version = record.version;
      if (!version || version.interfaceId !== project.id) throw new InterfaceError("INTERFACE_NOT_FOUND", 404);
      const manifest = parseManifest(version.manifestJson);
      const publishedProject = { ...project, name: manifest.metadata.name, slug: manifest.metadata.slug,
        description: manifest.metadata.description, category: manifest.metadata.category,
        language: manifest.metadata.language, updatedAt: version.publishedAt };
      const [owner] = await db.select({ name: schema.users.name, avatarUrl: schema.users.avatarUrl }).from(schema.users).where(eq(schema.users.id, ownerId)).limit(1);
      const counts = rowsOf<{ runCount: number }>(await db.execute(sql`
        SELECT count(*) FILTER (WHERE success)::integer AS "runCount"
        FROM run_events WHERE interface_id = ${project.id}::uuid
      `))[0];
      return { interface: publishedProject, owner, version: { ...version, manifestJson: manifest }, ...counts };
    },
    async setFeatured(id: string, adminId: string, featured: boolean) {
      const [user] = await db.select({ role: schema.users.role }).from(schema.users).where(eq(schema.users.id, adminId)).limit(1);
      if (user?.role !== "admin") throw new InterfaceError("FORBIDDEN", 403);
      const [project] = await db.select().from(schema.interfaces).where(eq(schema.interfaces.id, id)).limit(1);
      if (!project || project.status !== "published" || project.visibility !== "public") throw new InterfaceError("INTERFACE_NOT_FOUND", 404);
      await db.update(schema.interfaces).set({ featured, updatedAt: new Date() }).where(eq(schema.interfaces.id, id));
    },
  };
}
