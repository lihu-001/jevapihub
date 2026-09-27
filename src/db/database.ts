import { createDatabase } from "./client";

let instance: ReturnType<typeof createDatabase> | undefined;

export function getDatabase() {
  if (!instance) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is required for cloud features");
    instance = createDatabase(connectionString);
  }
  return instance.db;
}
