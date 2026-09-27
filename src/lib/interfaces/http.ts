import { z, ZodError } from "zod";
import { getDatabase } from "../../db/database";
import { getCurrentUserId } from "../auth/current-user";
import { ManifestValidationError } from "../manifest/validate";
import { readRuntimeJson } from "../runtime/read-json";
import { RuntimeError } from "../typesafe/errors";
import { createInterfaceService, InterfaceError } from "./service";

export const idSchema = z.uuid();
export const visibilitySchema = z.enum(["private", "unlisted", "public"]);
export const manifestBodySchema = z.object({ manifest: z.unknown() }).strict();
export const noStoreHeaders = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8" };

export function service() { return createInterfaceService(getDatabase()); }
export async function viewerId() { return getCurrentUserId(); }
export async function ownerId() {
  const id = await getCurrentUserId();
  if (!id) throw new InterfaceError("UNAUTHORIZED", 401);
  return id;
}
export async function jsonBody(request: Request) { return readRuntimeJson(request); }
export function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: noStoreHeaders }); }
export function handleCloudError(error: unknown): Response {
  if (error instanceof InterfaceError) return json({ error: { code: error.code, message: error.message } }, error.status);
  if (error instanceof RuntimeError) return json(error.toJSON(), error.status);
  if (error instanceof ManifestValidationError) return json({ error: { code: "INVALID_MANIFEST", message: "Manifest 无效" } }, 400);
  if (error instanceof ZodError) return json({ error: { code: "INVALID_INPUT", message: "请求数据无效" } }, 400);
  return json({ error: { code: "INTERNAL_ERROR", message: "服务器处理失败" } }, 500);
}
