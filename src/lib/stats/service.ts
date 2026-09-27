import { eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "../../db/schema";
import { InterfaceError } from "../interfaces/service";

type Db<T extends PgQueryResultHKT> = PgDatabase<T, typeof schema>;
type Totals = { totalRuns: number; successRuns: number; failedRuns: number; avgLatencyMs: number; inputTokens: number; outputTokens: number };
type Daily = { day: string; totalRuns: number; successRuns: number };
type Version = { versionId: string; versionNumber: number; totalRuns: number; successRuns: number };

function rowsOf<T>(result: unknown): T[] {
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) return result.rows as T[];
  if (Array.isArray(result)) return result as T[];
  throw new Error("Unexpected database result");
}

export async function getInterfaceStats<T extends PgQueryResultHKT>(db: Db<T>, id: string, ownerId: string) {
  const [project] = await db.select({ id: schema.interfaces.id, ownerId: schema.interfaces.ownerId, name: schema.interfaces.name })
    .from(schema.interfaces).where(eq(schema.interfaces.id, id)).limit(1);
  if (!project || project.ownerId !== ownerId) throw new InterfaceError("INTERFACE_NOT_FOUND", 404);
  const [totals] = rowsOf<Totals>(await db.execute(sql`
    SELECT count(*)::integer AS "totalRuns", count(*) FILTER (WHERE success)::integer AS "successRuns",
      count(*) FILTER (WHERE NOT success)::integer AS "failedRuns",
      COALESCE(round(avg(latency_ms)), 0)::integer AS "avgLatencyMs",
      COALESCE(sum(input_tokens), 0)::integer AS "inputTokens",
      COALESCE(sum(output_tokens), 0)::integer AS "outputTokens"
    FROM run_events WHERE interface_id = ${id}::uuid
  `));
  const daily = rowsOf<Daily>(await db.execute(sql`
    SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
      count(*)::integer AS "totalRuns", count(*) FILTER (WHERE success)::integer AS "successRuns"
    FROM run_events WHERE interface_id = ${id}::uuid AND created_at >= now() - interval '30 days'
    GROUP BY 1 ORDER BY 1 DESC
  `));
  const versions = rowsOf<Version>(await db.execute(sql`
    SELECT v.id AS "versionId", v.version_number AS "versionNumber", count(r.id)::integer AS "totalRuns",
      count(r.id) FILTER (WHERE r.success)::integer AS "successRuns"
    FROM interface_versions v LEFT JOIN run_events r ON r.interface_version_id = v.id
    WHERE v.interface_id = ${id}::uuid GROUP BY v.id, v.version_number ORDER BY v.version_number DESC
  `));
  return { interface: project, totals, daily, versions };
}
