import { eq } from "drizzle-orm";
import { Builder } from "../../../components/builder/builder";
import { getDatabase } from "../../../db/database";
import * as schema from "../../../db/schema";
import { getCurrentUserId } from "../../../lib/auth/current-user";

export default async function NewBuilderPage() {
  const userId = await getCurrentUserId();
  const [user] = userId ? await getDatabase().select({ role: schema.users.role }).from(schema.users).where(eq(schema.users.id, userId)).limit(1) : [];
  return <Builder canCloudSave={!!userId} canPublish={user?.role === "admin"} />;
}
