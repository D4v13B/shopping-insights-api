import { createMiddleware } from "hono/factory";
import { logger } from "@/lib/logger";
import type { AppEnv } from "@/types";

/** Una línea JSON por request, correlacionable por request_id. */
export const requestLogger = createMiddleware<AppEnv>(async (c, next) => {
  const start = performance.now();
  await next();
  const status = c.res.status;
  const entry = {
    request_id: c.get("requestId"),
    method: c.req.method,
    path: c.req.path,
    status,
    duration_ms: Math.round((performance.now() - start) * 10) / 10,
  };
  if (status >= 500) logger.error(entry, "request");
  else if (status >= 400) logger.warn(entry, "request");
  else logger.info(entry, "request");
});
