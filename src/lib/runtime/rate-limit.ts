import { createHash } from "node:crypto";
import { RuntimeError } from "../typesafe/errors";

const WINDOW_MS = 60_000;

export function createWindowLimiter(now: () => number = Date.now) {
  const counters = new Map<string, { window: number; count: number }>();
  return (identity: string, limit: number): boolean => {
    const window = Math.floor(now() / WINDOW_MS);
    const previous = counters.get(identity);
    const count = previous?.window === window ? previous.count : 0;
    if (count >= limit) return false;
    counters.set(identity, { window, count: count + 1 });
    if (counters.size > 10_000) {
      for (const [key, value] of counters) if (value.window < window) counters.delete(key);
    }
    return true;
  };
}

const claimWindow = createWindowLimiter();

function configuredLimit(raw: string | undefined, fallback: number) {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 && value <= 100_000 ? value : fallback;
}

export function enforceRuntimeRateLimit(request: Request, userId: string | null) {
  const address = (request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("x-real-ip") || "unknown").trim().slice(0, 128);
  const identity = userId ? `user:${userId}` : `guest:${createHash("sha256").update(address).digest("hex")}`;
  const limit = userId ? configuredLimit(process.env.RUNTIME_RATE_LIMIT_USER, 120) : configuredLimit(process.env.RUNTIME_RATE_LIMIT_GUEST, 60);
  if (!claimWindow(identity, limit)) throw new RuntimeError("RATE_LIMITED_BY_APP", 429, true);
}
