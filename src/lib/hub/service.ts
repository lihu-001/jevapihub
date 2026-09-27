import { and, eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "../../db/schema";
import { createInterfaceService, InterfaceError } from "../interfaces/service";
import { parseManifest } from "../manifest/validate";

type Db<T extends PgQueryResultHKT> = PgDatabase<T, typeof schema>;
export type HubSort = "latest" | "runs" | "stars" | "featured";
export type HubFilters = { search?: string; category?: string; tag?: string; language?: string; sort?: HubSort; featured?: boolean; page?: number };
export type HubCard = { id: string; ownerId: string; ownerName: string | null; slug: string; name: string; description: string;
  category: string; language: string; featured: boolean; versionId: string; versionNumber: number; model: string;
  tags: string[]; runCount: number; starCount: number; updatedAt: Date };

function rowsOf<T>(result: unknown): T[] {
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) return result.rows as T[];
  if (Array.isArray(result)) return result as T[];
  throw new Error("Unexpected database result");
}

export function createHubService<T extends PgQueryResultHKT>(db: Db<T>) {
  async function visibleProject(id: string, viewerId: string | null) {
    const [project] = await db.select().from(schema.interfaces).where(eq(schema.interfaces.id, id)).limit(1);
    if (!project || project.status !== "published" || (project.visibility === "private" && project.ownerId !== viewerId)) {
      throw new InterfaceError("INTERFACE_NOT_FOUND", 404);
    }
    return project;
  }

  return {
    async list(filters: HubFilters = {}): Promise<HubCard[]> {
      const sort = filters.sort ?? "featured";
      const order = sort === "runs" ? sql`COALESCE(r.run_count, 0) DESC, i.updated_at DESC`
        : sort === "stars" ? sql`COALESCE(s.star_count, 0) DESC, i.updated_at DESC`
          : sort === "latest" ? sql`i.updated_at DESC`
            : sql`i.featured DESC, i.updated_at DESC`;
      const page = Math.max(1, Math.min(1000, Math.floor(filters.page || 1)));
      const result = await db.execute(sql`
        SELECT i.id, i.owner_id AS "ownerId", u.name AS "ownerName", i.slug, i.name, i.description,
          i.category, i.language, i.featured, v.id AS "versionId", v.version_number AS "versionNumber",
          v.manifest_json->'runtime'->>'model' AS model,
          COALESCE(v.manifest_json->'metadata'->'tags', '[]'::jsonb) AS tags,
          COALESCE(r.run_count, 0)::integer AS "runCount", COALESCE(s.star_count, 0)::integer AS "starCount",
          i.updated_at AS "updatedAt"
        FROM interfaces i
        JOIN users u ON u.id = i.owner_id
        JOIN interface_versions v ON v.id = i.published_version_id
        LEFT JOIN (SELECT interface_id, count(*) AS run_count FROM run_events WHERE success = true GROUP BY interface_id) r ON r.interface_id = i.id
        LEFT JOIN (SELECT interface_id, count(*) AS star_count FROM stars GROUP BY interface_id) s ON s.interface_id = i.id
        WHERE i.status = 'published' AND i.visibility = 'public'
          AND (${filters.search?.trim() || ""} = '' OR position(lower(${filters.search?.trim() || ""}) in lower(i.name || ' ' || i.description)) > 0)
          AND (${filters.category || ""} = '' OR i.category = ${filters.category || ""})
          AND (${filters.language || ""} = '' OR i.language = ${filters.language || ""})
          AND (${filters.tag || ""} = '' OR COALESCE(v.manifest_json->'metadata'->'tags', '[]'::jsonb) @> jsonb_build_array(${filters.tag || ""}::text))
          AND (${!!filters.featured} = false OR i.featured = true)
        ORDER BY ${order}
        LIMIT 24 OFFSET ${(page - 1) * 24}
      `);
      return rowsOf<HubCard>(result);
    },
    async detail(ownerId: string, slug: string, viewerId: string | null) {
      const [project] = await db.select().from(schema.interfaces).where(and(eq(schema.interfaces.ownerId, ownerId), eq(schema.interfaces.slug, slug))).limit(1);
      if (!project || project.status !== "published" || (project.visibility === "private" && project.ownerId !== viewerId)) {
        throw new InterfaceError("INTERFACE_NOT_FOUND", 404);
      }
      const [version] = await db.select().from(schema.interfaceVersions).where(eq(schema.interfaceVersions.id, project.publishedVersionId!)).limit(1);
      if (!version || version.interfaceId !== project.id) throw new InterfaceError("INTERFACE_NOT_FOUND", 404);
      const [owner] = await db.select({ name: schema.users.name, avatarUrl: schema.users.avatarUrl }).from(schema.users).where(eq(schema.users.id, ownerId)).limit(1);
      const [star] = viewerId ? await db.select().from(schema.stars).where(and(eq(schema.stars.interfaceId, project.id), eq(schema.stars.userId, viewerId))).limit(1) : [];
      const counts = rowsOf<{ runCount: number; starCount: number }>(await db.execute(sql`
        SELECT (SELECT count(*)::integer FROM run_events WHERE interface_id = ${project.id}::uuid AND success = true) AS "runCount",
               (SELECT count(*)::integer FROM stars WHERE interface_id = ${project.id}::uuid) AS "starCount"
      `))[0];
      return { interface: project, owner, version: { ...version, manifestJson: parseManifest(version.manifestJson) }, starred: !!star, ...counts };
    },
    async star(id: string, userId: string) {
      await visibleProject(id, userId);
      await db.insert(schema.stars).values({ userId, interfaceId: id }).onConflictDoNothing();
    },
    async unstar(id: string, userId: string) {
      await visibleProject(id, userId);
      await db.delete(schema.stars).where(and(eq(schema.stars.userId, userId), eq(schema.stars.interfaceId, id)));
    },
    async fork(id: string, versionId: string | undefined, userId: string) {
      const source = await visibleProject(id, userId);
      const selectedVersionId = versionId ?? source.publishedVersionId;
      if (!selectedVersionId) throw new InterfaceError("VERSION_NOT_FOUND", 404);
      const selected = await createInterfaceService(db).getVersion(id, selectedVersionId, userId);
      const manifest = structuredClone(selected.version.manifestJson);
      delete manifest.version;
      manifest.metadata.name = `${manifest.metadata.name} (Fork)`.slice(0, 120);
      manifest.metadata.slug = `${manifest.metadata.slug.slice(0, 110)}-${crypto.randomUUID().slice(0, 8)}`;
      return db.transaction(async (tx) => {
        const [forked] = await tx.insert(schema.interfaces).values({ ownerId: userId, name: manifest.metadata.name,
          slug: manifest.metadata.slug, description: manifest.metadata.description, category: manifest.metadata.category,
          language: manifest.metadata.language, forkedFromInterfaceId: id, forkedFromVersionId: selectedVersionId,
        }).returning();
        await tx.insert(schema.interfaceDrafts).values({ interfaceId: forked.id, manifestJson: manifest });
        return forked;
      });
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
