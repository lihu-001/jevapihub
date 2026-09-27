import { and, desc, eq } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "../../db/schema";
import { parseManifest } from "../manifest/validate";
import type { Manifest } from "../manifest/types";

type Db<T extends PgQueryResultHKT> = PgDatabase<T, typeof schema>;
export type Visibility = "private" | "unlisted" | "public";

export class InterfaceError extends Error {
  constructor(public readonly code: string, public readonly status: number) { super(code); }
}

function draftManifest(raw: unknown): Manifest {
  const parsed = parseManifest(raw);
  const draft = structuredClone(parsed);
  delete draft.version;
  return draft;
}

function isVisible(row: typeof schema.interfaces.$inferSelect, viewerId: string | null) {
  return row.ownerId === viewerId || (row.status === "published" && row.visibility !== "private");
}

function summaryFromVersion(row: typeof schema.interfaces.$inferSelect, manifest: Manifest, publishedAt: Date) {
  return { ...row, name: manifest.metadata.name, slug: manifest.metadata.slug,
    description: manifest.metadata.description, category: manifest.metadata.category,
    language: manifest.metadata.language, updatedAt: publishedAt,
  };
}

export function createInterfaceService<T extends PgQueryResultHKT>(db: Db<T>) {
  async function getRow(id: string) {
    const [row] = await db.select().from(schema.interfaces).where(eq(schema.interfaces.id, id)).limit(1);
    if (!row) throw new InterfaceError("INTERFACE_NOT_FOUND", 404);
    return row;
  }
  async function requireOwner(id: string, ownerId: string) {
    const row = await getRow(id);
    if (row.ownerId !== ownerId) throw new InterfaceError("INTERFACE_NOT_FOUND", 404);
    if (row.status === "archived") throw new InterfaceError("INTERFACE_ARCHIVED", 409);
    return row;
  }
  return {
    async create(ownerId: string, rawManifest: unknown, aiGenerated = false) {
      const manifest = draftManifest(rawManifest);
      try {
        return await db.transaction(async (tx) => {
          const [row] = await tx.insert(schema.interfaces).values({
            ownerId, name: manifest.metadata.name, slug: manifest.metadata.slug,
            description: manifest.metadata.description, category: manifest.metadata.category, language: manifest.metadata.language,
          }).returning();
          await tx.insert(schema.interfaceDrafts).values({ interfaceId: row.id, manifestJson: manifest, aiGenerated });
          return row;
        });
      } catch (error) {
        if (isUniqueViolation(error)) throw new InterfaceError("SLUG_ALREADY_EXISTS", 409);
        throw error;
      }
    },
    async listMine(ownerId: string) {
      return db.select({ id: schema.interfaces.id, name: schema.interfaces.name, slug: schema.interfaces.slug,
        description: schema.interfaces.description, visibility: schema.interfaces.visibility, status: schema.interfaces.status,
        publishedVersionId: schema.interfaces.publishedVersionId, updatedAt: schema.interfaces.updatedAt,
      }).from(schema.interfaces).where(eq(schema.interfaces.ownerId, ownerId)).orderBy(desc(schema.interfaces.updatedAt));
    },
    async read(id: string, viewerId: string | null) {
      const row = await getRow(id);
      if (!isVisible(row, viewerId)) throw new InterfaceError("INTERFACE_NOT_FOUND", 404);
      if (row.ownerId === viewerId) {
        const [draft] = await db.select().from(schema.interfaceDrafts).where(eq(schema.interfaceDrafts.interfaceId, id)).limit(1);
        return { interface: row, manifest: draft ? parseManifest(draft.manifestJson) : null, draft: true, aiGenerated: draft?.aiGenerated ?? false };
      }
      const [version] = await db.select().from(schema.interfaceVersions).where(eq(schema.interfaceVersions.id, row.publishedVersionId!)).limit(1);
      if (!version || version.interfaceId !== row.id) throw new InterfaceError("INTERFACE_NOT_FOUND", 404);
      const manifest = parseManifest(version.manifestJson);
      return { interface: summaryFromVersion(row, manifest, version.publishedAt), manifest, draft: false, aiGenerated: false };
    },
    async saveDraft(id: string, ownerId: string, rawManifest: unknown, aiGenerated = false) {
      await requireOwner(id, ownerId);
      const manifest = draftManifest(rawManifest);
      try {
        await db.transaction(async (tx) => {
          const [current] = await tx.select({ status: schema.interfaces.status }).from(schema.interfaces)
            .where(eq(schema.interfaces.id, id)).for("update").limit(1);
          if (!current || current.status === "archived") throw new InterfaceError("INTERFACE_ARCHIVED", 409);
          await tx.update(schema.interfaceDrafts).set({ manifestJson: manifest, aiGenerated, updatedAt: new Date() }).where(eq(schema.interfaceDrafts.interfaceId, id));
          await tx.update(schema.interfaces).set(current.status === "draft" ? {
            name: manifest.metadata.name, slug: manifest.metadata.slug, description: manifest.metadata.description,
            category: manifest.metadata.category, language: manifest.metadata.language, updatedAt: new Date(),
          } : { updatedAt: new Date() }).where(eq(schema.interfaces.id, id));
        });
      } catch (error) {
        if (isUniqueViolation(error)) throw new InterfaceError("SLUG_ALREADY_EXISTS", 409);
        throw error;
      }
    },
    async setVisibility(id: string, ownerId: string, visibility: Visibility) {
      await requireOwner(id, ownerId);
      await db.update(schema.interfaces).set({ visibility, updatedAt: new Date() }).where(eq(schema.interfaces.id, id));
    },
    async archive(id: string, ownerId: string) {
      await requireOwner(id, ownerId);
      await db.update(schema.interfaces).set({ status: "archived", visibility: "private", updatedAt: new Date() }).where(eq(schema.interfaces.id, id));
    },
    async publish(id: string, ownerId: string, visibility?: Visibility) {
      await requireOwner(id, ownerId);
      return db.transaction(async (tx) => {
        const [row] = await tx.select().from(schema.interfaces).where(eq(schema.interfaces.id, id)).for("update").limit(1);
        if (!row || row.ownerId !== ownerId || row.status === "archived") throw new InterfaceError("INTERFACE_NOT_FOUND", 404);
        const [draft] = await tx.select().from(schema.interfaceDrafts).where(eq(schema.interfaceDrafts.interfaceId, id)).limit(1);
        if (!draft) throw new InterfaceError("DRAFT_NOT_FOUND", 404);
        const manifest = draftManifest(draft.manifestJson);
        const [latest] = await tx.select({ versionNumber: schema.interfaceVersions.versionNumber }).from(schema.interfaceVersions)
          .where(eq(schema.interfaceVersions.interfaceId, id)).orderBy(desc(schema.interfaceVersions.versionNumber)).limit(1);
        const versionNumber = (latest?.versionNumber ?? 0) + 1;
        const [version] = await tx.insert(schema.interfaceVersions).values({ interfaceId: id, versionNumber,
          manifestJson: { ...manifest, version: versionNumber }, createdBy: ownerId,
        }).returning();
        await tx.update(schema.interfaces).set({ status: "published", visibility: visibility ?? row.visibility,
          name: manifest.metadata.name, slug: manifest.metadata.slug, description: manifest.metadata.description,
          category: manifest.metadata.category, language: manifest.metadata.language,
          publishedVersionId: version.id, updatedAt: new Date(),
        }).where(eq(schema.interfaces.id, id));
        return version;
      });
    },
    async listVersions(id: string, viewerId: string | null) {
      const row = await getRow(id);
      if (!isVisible(row, viewerId)) throw new InterfaceError("INTERFACE_NOT_FOUND", 404);
      return db.select({ id: schema.interfaceVersions.id, versionNumber: schema.interfaceVersions.versionNumber,
        createdAt: schema.interfaceVersions.createdAt, publishedAt: schema.interfaceVersions.publishedAt,
      }).from(schema.interfaceVersions).where(eq(schema.interfaceVersions.interfaceId, id)).orderBy(desc(schema.interfaceVersions.versionNumber));
    },
    async getVersion(id: string, versionId: string, viewerId: string | null) {
      const row = await getRow(id);
      if (!isVisible(row, viewerId)) throw new InterfaceError("INTERFACE_NOT_FOUND", 404);
      const [version] = await db.select().from(schema.interfaceVersions)
        .where(and(eq(schema.interfaceVersions.id, versionId), eq(schema.interfaceVersions.interfaceId, id))).limit(1);
      if (!version) throw new InterfaceError("VERSION_NOT_FOUND", 404);
      const manifest = parseManifest(version.manifestJson);
      return { interface: row.ownerId === viewerId ? row : summaryFromVersion(row, manifest, version.publishedAt),
        version: { ...version, manifestJson: manifest } };
    },
  };
}

function isUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === "object" && "code" in error && error.code === "23505";
}
