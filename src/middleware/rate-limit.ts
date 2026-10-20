import type { Context } from "hono";
import { getConnInfo } from "hono/bun";
import { rateLimiter } from "hono-rate-limiter";
import { env } from "@/env";
import { TooManyRequestsError } from "@/lib/errors";

function clientKey(c: Context): string {
  try {
    return getConnInfo(c).remote.address ?? "unknown";
  } catch {
    return "unknown"; // app.request() en tests no tiene socket
  }
}

/** El SSR de la web comparte una sola IP: si presenta el token interno, no cuenta para el límite. */
function isInternal(c: Context): boolean {
  const token = env.INTERNAL_API_TOKEN;
  return token !== undefined && c.req.header("x-internal-token") === token;
}

export function limitPerMinute(limit: number) {
  return rateLimiter({
    windowMs: 60_000,
    limit,
    standardHeaders: "draft-7",
    keyGenerator: clientKey,
    skip: isInternal,
    handler: () => {
      throw new TooManyRequestsError();
    },
  });
}

export const globalRateLimit = limitPerMinute(env.RATE_LIMIT_PER_MINUTE);
export const etlRateLimit = limitPerMinute(env.ETL_RATE_LIMIT_PER_MINUTE);
