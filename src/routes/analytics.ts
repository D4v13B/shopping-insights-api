import { createRoute, z } from "@hono/zod-openapi";
import { db } from "@/db/client";
import { FiltersSchema } from "@/lib/filters";
import { createRouter, errorResponses, jsonContent } from "@/lib/openapi";
import {
  getDemographics,
  getFilterOptions,
  getKpis,
  getProductRanking,
  getSalesByCategory,
  getSalesBySeason,
  getSegments,
  getStates,
  RANKING_METRICS,
} from "@/services/analytics";

const tags = ["Analítica"];
const money = (example: number) => z.number().openapi({ example });
const int = (example: number) => z.number().int().openapi({ example });

// ---------- Esquemas de respuesta ----------

const FilterOptionsSchema = z
  .object({
    categories: z.array(z.string()).openapi({ example: ["Accessories", "Clothing"] }),
    seasons: z.array(z.string()).openapi({ example: ["Spring", "Summer", "Fall", "Winter"] }),
    genders: z.array(z.string()).openapi({ example: ["Female", "Male"] }),
    ageBands: z.array(z.string()).openapi({ example: ["18-24", "25-34"] }),
    regions: z.array(z.string()).openapi({ example: ["Midwest", "Northeast"] }),
    states: z
      .array(z.object({ code: z.string(), name: z.string() }))
      .openapi({ example: [{ code: "AL", name: "Alabama" }] }),
    paymentMethods: z.array(z.string()).openapi({ example: ["Bank Transfer", "Cash"] }),
  })
  .openapi("FilterOptions");

const KpisSchema = z
  .object({
    revenue: money(233081),
    orders: int(3900),
    customers: int(3900),
    avgTicket: money(59.76),
    avgRating: z.number().openapi({ example: 3.75 }),
    subscribedPct: z.number().openapi({ example: 27, description: "% de clientes suscritos" }),
    promoPct: z.number().openapi({ example: 43, description: "% de órdenes con promoción" }),
  })
  .openapi("Kpis");

const SalesByCategorySchema = z
  .array(
    z.object({
      category: z.string().openapi({ example: "Clothing" }),
      revenue: money(104264),
      orders: int(1737),
      avgTicket: money(60.03),
    }),
  )
  .openapi("SalesByCategory");

const SalesBySeasonSchema = z
  .array(
    z.object({
      season: z.string().openapi({ example: "Fall" }),
      category: z.string().openapi({ example: "Clothing" }),
      revenue: money(27000),
      orders: int(450),
    }),
  )
  .openapi("SalesBySeason");

const ProductRankingSchema = z
  .array(
    z.object({
      rank: int(1),
      productId: int(4),
      itemName: z.string().openapi({ example: "Blouse" }),
      category: z.string().openapi({ example: "Clothing" }),
      revenue: money(10410),
      orders: int(171),
      avgRating: z.number().openapi({ example: 3.75 }),
    }),
  )
  .openapi("ProductRanking");

const SegmentsSchema = z
  .array(
    z.object({
      segment: z.string().openapi({ example: "Campeones" }),
      customers: int(429),
      revenue: money(30000),
      avgTicket: money(70.1),
      avgAnnualValue: money(2900.5),
      avgPreviousPurchases: z.number().openapi({ example: 42.3 }),
      sharePct: z.number().openapi({ example: 11 }),
    }),
  )
  .openapi("Segments");

const DemographicsSchema = z
  .object({
    matrix: z.array(
      z.object({
        ageBand: z.string().openapi({ example: "25-34" }),
        gender: z.string().openapi({ example: "Female" }),
        customers: int(240),
        revenue: money(14200),
        avgTicket: money(59.2),
      }),
    ),
    subscription: z.array(
      z.object({
        subscribed: z.boolean(),
        gender: z.string().openapi({ example: "Male" }),
        customers: int(1053),
        revenue: money(62645),
        avgTicket: money(59.49),
        avgRating: z.number().openapi({ example: 3.74 }),
      }),
    ),
  })
  .openapi("Demographics");

const StatesSchema = z
  .array(
    z.object({
      stateCode: z.string().openapi({ example: "MT" }),
      stateName: z.string().openapi({ example: "Montana" }),
      region: z.string().openapi({ example: "West" }),
      revenue: money(5784),
      orders: int(96),
      avgTicket: money(60.25),
    }),
  )
  .openapi("States");

// ---------- Rutas ----------

const ok = <T extends z.ZodType>(schema: T) => ({
  200: jsonContent(schema, "OK"),
  ...errorResponses,
});

const RankingQuery = FiltersSchema.extend({
  metric: z.enum(RANKING_METRICS).default("revenue").openapi({ example: "revenue" }),
  limit: z.coerce.number().int().min(1).max(25).default(10).openapi({ example: 10 }),
});

const filterOptionsRoute = createRoute({
  method: "get",
  path: "/filters/options",
  tags,
  summary: "Valores disponibles para cada filtro",
  responses: ok(FilterOptionsSchema),
});

const kpisRoute = createRoute({
  method: "get",
  path: "/kpis",
  tags,
  summary: "KPIs globales",
  request: { query: FiltersSchema },
  responses: ok(KpisSchema),
});

const byCategoryRoute = createRoute({
  method: "get",
  path: "/sales/by-category",
  tags,
  summary: "Ingresos y órdenes por categoría",
  request: { query: FiltersSchema },
  responses: ok(SalesByCategorySchema),
});

const bySeasonRoute = createRoute({
  method: "get",
  path: "/sales/by-season",
  tags,
  summary: "Ingresos por temporada y categoría",
  request: { query: FiltersSchema },
  responses: ok(SalesBySeasonSchema),
});

const rankingRoute = createRoute({
  method: "get",
  path: "/products/ranking",
  tags,
  summary: "Top N productos por métrica",
  request: { query: RankingQuery },
  responses: ok(ProductRankingSchema),
});

const segmentsRoute = createRoute({
  method: "get",
  path: "/customers/segments",
  tags,
  summary: "Clientes, ingresos y ticket por segmento",
  request: { query: FiltersSchema },
  responses: ok(SegmentsSchema),
});

const demographicsRoute = createRoute({
  method: "get",
  path: "/customers/demographics",
  tags,
  summary: "Matriz rango de edad × género y suscripción × género",
  request: { query: FiltersSchema },
  responses: ok(DemographicsSchema),
});

const statesRoute = createRoute({
  method: "get",
  path: "/geo/states",
  tags,
  summary: "Ventas por estado (siempre los 50)",
  request: { query: FiltersSchema },
  responses: ok(StatesSchema),
});

export const analyticsRoutes = createRouter()
  .openapi(filterOptionsRoute, async (c) => c.json(await getFilterOptions(db), 200))
  .openapi(kpisRoute, async (c) => c.json(await getKpis(db, c.req.valid("query")), 200))
  .openapi(byCategoryRoute, async (c) =>
    c.json(await getSalesByCategory(db, c.req.valid("query")), 200),
  )
  .openapi(bySeasonRoute, async (c) =>
    c.json(await getSalesBySeason(db, c.req.valid("query")), 200),
  )
  .openapi(rankingRoute, async (c) => {
    const { metric, limit, ...filters } = c.req.valid("query");
    return c.json(await getProductRanking(db, filters, metric, limit), 200);
  })
  .openapi(segmentsRoute, async (c) => c.json(await getSegments(db, c.req.valid("query")), 200))
  .openapi(demographicsRoute, async (c) =>
    c.json(await getDemographics(db, c.req.valid("query")), 200),
  )
  .openapi(statesRoute, async (c) => c.json(await getStates(db, c.req.valid("query")), 200));
