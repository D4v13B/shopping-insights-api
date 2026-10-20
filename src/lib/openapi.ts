import { OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppEnv } from "@/types";
import { ValidationError } from "./errors";

export const ProblemSchema = z
  .object({
    type: z.string().openapi({ example: "urn:shopping-insights:problem:validation-error" }),
    title: z.string().openapi({ example: "Parámetros inválidos" }),
    status: z.number().int().openapi({ example: 422 }),
    detail: z.string().optional(),
    instance: z.string().openapi({ example: "/api/v1/purchases" }),
    requestId: z.string().optional(),
    errors: z
      .array(z.object({ path: z.string(), message: z.string() }))
      .optional()
      .openapi({
        example: [{ path: "pageSize", message: "Too big: expected number to be <=100" }],
      }),
  })
  .openapi("Problem");

const problem = (description: string) => ({
  description,
  content: { "application/problem+json": { schema: ProblemSchema } },
});

export const errorResponses = {
  422: problem("Parámetros inválidos"),
  429: problem("Límite de solicitudes superado"),
  500: problem("Error interno"),
} as const;

export const jsonContent = <T extends z.ZodType>(schema: T, description: string) => ({
  description,
  content: { "application/json": { schema } },
});

export { problem };

/** OpenAPIHono cuyos errores de validación de Zod salen como problem+json 422. */
export function createRouter() {
  return new OpenAPIHono<AppEnv>({
    defaultHook: (result) => {
      if (!result.success) {
        throw new ValidationError(
          result.error.issues.map((issue) => ({
            path: issue.path.join(".") || "(raíz)",
            message: issue.message,
          })),
        );
      }
    },
  });
}
