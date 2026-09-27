import { parseManifest, ManifestValidationError } from "../manifest/validate";
import { validateInputs, InputValidationError } from "../manifest/validate-inputs";
import { resolveState } from "../manifest/resolve-state";
import { applyWeightedScore } from "../postprocess/weighted-score";
import { callTypeSafe, type TypeSafeClientOptions } from "../typesafe/client";
import { RuntimeError } from "../typesafe/errors";
import { InvalidUpstreamResponseError } from "../typesafe/response";

export async function runManifest(
  rawManifest: unknown, rawInputs: unknown, apiKey: string, clientOptions: TypeSafeClientOptions = {},
) {
  if (!apiKey.trim()) throw new RuntimeError("MISSING_TYPESAFE_KEY", 400);
  let manifest;
  try { manifest = parseManifest(rawManifest); }
  catch (error) {
    if (error instanceof ManifestValidationError) throw new RuntimeError("INVALID_MANIFEST", 400);
    throw error;
  }
  let inputs;
  try { inputs = validateInputs(manifest, rawInputs); }
  catch (error) {
    if (error instanceof InputValidationError) throw new RuntimeError("INVALID_INPUT", 400);
    throw error;
  }
  let state;
  try { state = resolveState(manifest.stateTemplate, inputs); }
  catch { throw new RuntimeError("INVALID_INPUT", 400); }
  let result;
  try {
    result = await callTypeSafe(
      { state, model: manifest.runtime.model, questions: manifest.questions }, apiKey,
      { ...clientOptions, timeoutMs: manifest.runtime.timeoutMs, maxRetries: manifest.runtime.maxRetries },
    );
  } catch (error) {
    if (error instanceof InvalidUpstreamResponseError) throw new RuntimeError("UPSTREAM_INVALID_RESPONSE", 502);
    throw error;
  }
  // Provider fields are allowlisted by the parser; never return the API key.
  if (JSON.stringify(result).includes(apiKey)) throw new RuntimeError("UPSTREAM_INVALID_RESPONSE", 502);
  try {
    return { result, metrics: applyWeightedScore(manifest, result) };
  } catch { throw new RuntimeError("POSTPROCESS_ERROR", 500); }
}
