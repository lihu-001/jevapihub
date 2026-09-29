import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { Builder } from "../../../components/builder/builder";
import { getDatabase } from "../../../db/database";
import * as schema from "../../../db/schema";
import { getCurrentUserId } from "../../../lib/auth/current-user";
import { service } from "../../../lib/interfaces/http";
import { InterfaceError } from "../../../lib/interfaces/service";

export default async function CloudBuilderPage({ params }: { params: Promise<{ interfaceId: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");
  const project = await service().read((await params).interfaceId, userId).catch((error: unknown) => {
    if (error instanceof InterfaceError && error.status === 404) notFound();
    throw error;
  });
  if (project.interface.ownerId !== userId || !project.manifest) notFound();
  const [user] = await getDatabase().select({ role: schema.users.role }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  return <Builder initialManifest={project.manifest} cloudId={project.interface.id} canCloudSave canPublish={user?.role === "admin"} initialAiGenerated={project.aiGenerated} initialVisibility={project.interface.visibility as "private" | "unlisted" | "public"} />;
}
