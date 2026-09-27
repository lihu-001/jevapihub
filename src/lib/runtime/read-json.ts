import { RuntimeError } from "../typesafe/errors";

const DEFAULT_MAX_BYTES = 1_048_576;

export async function readRuntimeJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new RuntimeError("INVALID_INPUT", 415);
  }
  const configured = Number(process.env.RUNTIME_MAX_BODY_BYTES);
  const maxBytes = Number.isSafeInteger(configured) && configured > 0 ? configured : DEFAULT_MAX_BYTES;
  const reader = request.body?.getReader();
  if (!reader) throw new RuntimeError("INVALID_INPUT", 400);
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel();
        throw new RuntimeError("INVALID_INPUT", 413);
      }
      chunks.push(value);
    }
    const data = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      data.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(data)) as unknown;
  } catch (error) {
    if (error instanceof RuntimeError) throw error;
    throw new RuntimeError("INVALID_INPUT", 400);
  }
}
