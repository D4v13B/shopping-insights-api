import { createHash, timingSafeEqual } from "node:crypto";
import { createMiddleware } from "hono/factory";
import { env } from "@/env";
import { UnauthorizedError } from "@/lib/errors";

const sha256 = (value: string) => createHash("sha256").update(value).digest();
const expected = sha256(env.ETL_API_KEY);

/** Compara hashes de igual longitud: timingSafeEqual lanza si las longitudes difieren. */
export function isValidApiKey(candidate: string | undefined): boolean {
  return candidate !== undefined && timingSafeEqual(sha256(candidate), expected);
}

export const apiKeyAuth = createMiddleware(async (c, next) => {
  if (!isValidApiKey(c.req.header("x-api-key"))) throw new UnauthorizedError();
  await next();
});
