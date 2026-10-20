import { z } from "@hono/zod-openapi";

export const MAX_PAGE_SIZE = 100;

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20).openapi({ example: 20 }),
});

export const PageMetaSchema = z
  .object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  })
  .openapi("PageMeta");

export function pageMeta(page: number, pageSize: number, total: number) {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** `sort=campo:asc|desc`, solo sobre una lista blanca de campos. */
export function sortSchema<const T extends readonly [string, ...string[]]>(
  fields: T,
  fallback: string,
) {
  const pattern = new RegExp(`^(${fields.join("|")}):(asc|desc)$`);
  return z
    .string()
    .regex(pattern, `Formato campo:asc|desc; campos permitidos: ${fields.join(", ")}`)
    .default(fallback)
    .openapi({ example: fallback });
}

export function parseSort<T extends string>(
  value: string,
): { field: T; direction: "asc" | "desc" } {
  const [field, direction] = value.split(":");
  return { field: field as T, direction: direction === "desc" ? "desc" : "asc" };
}
