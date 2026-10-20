import { swaggerUI } from "@hono/swagger-ui";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { env } from "@/env";
import { AppError, NotFoundError, problemResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { createRouter } from "@/lib/openapi";
import { globalRateLimit } from "@/middleware/rate-limit";
import { requestLogger } from "@/middleware/request-logger";
import { analyticsRoutes } from "@/routes/analytics";
import { etlRoutes } from "@/routes/etl";
import { healthRoutes } from "@/routes/health";
import { purchasesRoutes } from "@/routes/purchases";

export const API_PREFIX = "/api/v1";

const OPENAPI_INFO = {
  openapi: "3.1.0",
  info: {
    title: "Shopping Insights API",
    version: "1.0.0",
    description:
      "API analítica de solo lectura sobre el dataset Customer Shopping Trends. " +
      "Los errores siguen RFC 9457 (application/problem+json). " +
      "Todos los endpoints analíticos aceptan los mismos filtros opcionales.",
  },
  tags: [
    { name: "Analítica", description: "KPIs y agregaciones para el dashboard" },
    { name: "Compras", description: "Explorador de compras y exportación" },
    { name: "ETL", description: "Auditoría y disparo del ETL" },
    { name: "Sistema" },
  ],
};

export function createApp() {
  const app = createRouter();

  app.openAPIRegistry.registerComponent("securitySchemes", "ApiKeyAuth", {
    type: "apiKey",
    in: "header",
    name: "X-API-Key",
    description: "Necesaria solo para POST /api/v1/etl/run",
  });

  app.use("*", requestId());
  app.use("*", requestLogger);
  app.use("*", secureHeaders({ crossOriginResourcePolicy: "cross-origin" }));
  app.use(
    "*",
    cors({
      origin: env.WEB_ORIGIN,
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Content-Type", "X-API-Key"],
      exposeHeaders: ["Location", "Content-Disposition", "X-Request-Id"],
      maxAge: 600,
    }),
  );
  app.use(`${API_PREFIX}/*`, globalRateLimit);

  app.route("/", healthRoutes);
  app.route(API_PREFIX, analyticsRoutes);
  app.route(API_PREFIX, purchasesRoutes);
  app.route(API_PREFIX, etlRoutes);

  app.doc31("/openapi.json", OPENAPI_INFO);
  app.get("/docs", swaggerUI({ url: "/openapi.json", title: "Shopping Insights API" }));
  app.get("/", (c) => c.redirect("/docs"));

  app.notFound((c) => problemResponse(c, new NotFoundError(`No existe la ruta ${c.req.path}`)));
  app.onError((error, c) => {
    if (error instanceof AppError) return problemResponse(c, error);
    logger.error({ err: error, request_id: c.get("requestId") }, "error no controlado");
    const detail =
      env.NODE_ENV === "production" ? "Ocurrió un error inesperado" : String(error.message);
    return problemResponse(c, new AppError(500, "internal-error", "Error interno", detail));
  });

  return app;
}

export function openApiDocument() {
  return createApp().getOpenAPI31Document(OPENAPI_INFO);
}

export type AppType = ReturnType<typeof createApp>;
