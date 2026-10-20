import { createRoute, z } from "@hono/zod-openapi";
import { db } from "@/db/client";
import { ETL_RUN_STATUSES, ETL_RUN_TRIGGERS } from "@/db/schema";
import { createRouter, errorResponses, jsonContent, problem } from "@/lib/openapi";
import { apiKeyAuth } from "@/middleware/api-key";
import { etlRateLimit } from "@/middleware/rate-limit";
import { getRun, getRuns, requestRun } from "@/services/etl";

const tags = ["ETL"];

const EtlRunSchema = z
  .object({
    id: z.uuid().openapi({ example: "0b8f8a8e-6c0e-4b8e-9d2a-1f7f0b8a9c11" }),
    status: z.enum(ETL_RUN_STATUSES).openapi({ example: "success" }),
    trigger: z.enum(ETL_RUN_TRIGGERS).openapi({ example: "api" }),
    source: z.string().nullable().openapi({ example: "local" }),
    requestedAt: z.string().openapi({ example: "2026-10-19T19:36:27.239Z" }),
    startedAt: z.string().nullable(),
    finishedAt: z.string().nullable(),
    rowsRead: z.number().int().nullable().openapi({ example: 3900 }),
    rowsValid: z.number().int().nullable().openapi({ example: 3900 }),
    rowsRejected: z.number().int().nullable().openapi({ example: 0 }),
    durationMs: z.number().int().nullable().openapi({ example: 298 }),
    error: z.string().nullable(),
    qualityReport: z
      .record(z.string(), z.unknown())
      .nullable()
      .openapi({ description: "Reporte de calidad de datos generado por el ETL" }),
  })
  .openapi("EtlRun");

const RunIdParam = z.object({
  id: z.uuid().openapi({
    param: { name: "id", in: "path" },
    example: "0b8f8a8e-6c0e-4b8e-9d2a-1f7f0b8a9c11",
  }),
});

export const etlRoutes = createRouter()
  .openapi(
    createRoute({
      method: "get",
      path: "/etl/runs",
      tags,
      summary: "Últimas ejecuciones del ETL con su reporte de calidad",
      request: {
        query: z.object({
          limit: z.coerce.number().int().min(1).max(100).default(20).openapi({ example: 20 }),
        }),
      },
      responses: { 200: jsonContent(z.array(EtlRunSchema), "Ejecuciones"), ...errorResponses },
    }),
    async (c) => c.json(await getRuns(db, c.req.valid("query").limit), 200),
  )
  .openapi(
    createRoute({
      method: "get",
      path: "/etl/runs/{id}",
      tags,
      summary: "Detalle de una ejecución",
      request: { params: RunIdParam },
      responses: {
        200: jsonContent(EtlRunSchema, "Ejecución"),
        404: problem("No existe"),
        ...errorResponses,
      },
    }),
    async (c) => c.json(await getRun(db, c.req.valid("param").id), 200),
  )
  .openapi(
    createRoute({
      method: "post",
      path: "/etl/run",
      tags,
      summary: "Solicita una recarga del ETL (asíncrona)",
      description:
        "Registra la solicitud en etl_runs y avisa al worker con NOTIFY. Seguir el estado en el `Location` devuelto.",
      security: [{ ApiKeyAuth: [] }],
      middleware: [etlRateLimit, apiKeyAuth] as const,
      responses: {
        202: {
          ...jsonContent(
            z.object({ id: z.uuid(), status: z.literal("requested") }).openapi("EtlRunAccepted"),
            "Solicitud aceptada",
          ),
          headers: z.object({ Location: z.string().openapi({ example: "/api/v1/etl/runs/{id}" }) }),
        },
        401: problem("Falta la API key o no es válida"),
        409: problem("Ya hay una ejecución solicitada o en curso"),
        ...errorResponses,
      },
    }),
    async (c) => {
      const { id } = await requestRun(db);
      c.header("Location", `/api/v1/etl/runs/${id}`);
      return c.json({ id, status: "requested" as const }, 202);
    },
  );
