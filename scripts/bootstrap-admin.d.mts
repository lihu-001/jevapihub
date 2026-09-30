import type { PGlite } from "@electric-sql/pglite";
import type { Client } from "pg";

export declare function adminEmail(): string;
export declare function bootstrapAdmin(
  client: PGlite | Client,
  options?: { password?: string },
): Promise<{ email: string; password: string | null; created: boolean }>;
