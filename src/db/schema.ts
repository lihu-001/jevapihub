import { boolean, date, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").unique(),
  avatarUrl: text("avatar_url"),
  role: varchar("role", { length: 16 }).notNull().default("user"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const oauthAccounts = pgTable("oauth_accounts", {
  provider: varchar("provider", { length: 32 }).notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  userId: uuid("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.provider, table.providerAccountId] })]);

export const interfaces = pgTable("interfaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").notNull().references(() => users.id),
  name: varchar("name", { length: 120 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull(),
  description: text("description").notNull().default(""),
  category: varchar("category", { length: 64 }).notNull(),
  language: varchar("language", { length: 32 }).notNull(),
  visibility: varchar("visibility", { length: 16 }).notNull().default("private"),
  status: varchar("status", { length: 16 }).notNull().default("draft"),
  forkedFromInterfaceId: uuid("forked_from_interface_id"),
  forkedFromVersionId: uuid("forked_from_version_id"),
  publishedVersionId: uuid("published_version_id"),
  featured: boolean("featured").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("interfaces_owner_slug_unique").on(table.ownerId, table.slug)]);

export const interfaceDrafts = pgTable("interface_drafts", {
  interfaceId: uuid("interface_id").primaryKey().references(() => interfaces.id),
  manifestJson: jsonb("manifest_json").notNull(),
  aiGenerated: boolean("ai_generated").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const aiBuilderUsage = pgTable("ai_builder_usage", {
  userId: uuid("user_id").notNull().references(() => users.id),
  usageDate: date("usage_date").notNull(),
  requestCount: integer("request_count").notNull().default(0),
}, (table) => [primaryKey({ columns: [table.userId, table.usageDate] })]);

export const interfaceVersions = pgTable("interface_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  interfaceId: uuid("interface_id").notNull().references(() => interfaces.id),
  versionNumber: integer("version_number").notNull(),
  manifestJson: jsonb("manifest_json").notNull(),
  changelog: text("changelog"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("interface_versions_number_unique").on(table.interfaceId, table.versionNumber)]);

export const stars = pgTable("stars", {
  userId: uuid("user_id").notNull().references(() => users.id),
  interfaceId: uuid("interface_id").notNull().references(() => interfaces.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.userId, table.interfaceId] })]);

export const runEvents = pgTable("run_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  interfaceId: uuid("interface_id").references(() => interfaces.id),
  interfaceVersionId: uuid("interface_version_id").references(() => interfaceVersions.id),
  userId: uuid("user_id").references(() => users.id),
  anonymousSessionHash: text("anonymous_session_hash"),
  success: boolean("success").notNull(),
  providerModel: text("provider_model"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  latencyMs: integer("latency_ms").notNull(),
  providerStatus: integer("provider_status"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
