import type { PGlite } from "@electric-sql/pglite";

export declare function seedCatalog(client: PGlite, root?: string): Promise<string[]>;
