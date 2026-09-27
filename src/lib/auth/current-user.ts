import { getServerSession } from "next-auth";
import { authOptions } from "./options";

export async function getCurrentUserId(): Promise<string | null> {
  if (!process.env.AUTH_SECRET) return null;
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}
