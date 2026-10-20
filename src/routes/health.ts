import { createRoute, z } from "@hono/zod-openapi";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { logger } from "@/lib/logger";
import { createRouter, jsonContent } from "@/lib/openapi";

const HealthSchema = z
  .object({
    status: z.enum(["ok", "degraded"]).openapi({ example: "ok" }),
    database: z.enum(["up", "down"]).openapi({ example: "up" }),
    uptimeSeconds: z.number().openapi({ example: 42 }),
  })
  .openapi("Health");

export const healthRoutes = createRouter().openapi(
  createRoute({
    method: "get",
    path: "/health",
    tags: ["Sistema"],
    summary: "Estado de la API y de la conexión a la base",
    responses: {
      200: jsonContent(HealthSchema, "Todo funciona"),
      503: jsonContent(HealthSchema, "La base no responde"),
    },
  }),
  async (c) => {
    const uptimeSeconds = Math.round(process.uptime());
    try {
      await db.execute(sql`select 1`);
      return c.json({ status: "ok" as const, database: "up" as const, uptimeSeconds }, 200);
    } catch (error) {
      logger.error({ err: error }, "health: base de datos no disponible");
      return c.json({ status: "degraded" as const, database: "down" as const, uptimeSeconds }, 503);
    }
  },
);
