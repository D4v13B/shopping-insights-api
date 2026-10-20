import { createRoute, z } from "@hono/zod-openapi";
import { db } from "@/db/client";
import { FiltersSchema } from "@/lib/filters";
import { createRouter, errorResponses, jsonContent } from "@/lib/openapi";
import { PageMetaSchema, PaginationSchema, sortSchema } from "@/lib/pagination";
import { exportPurchasesCsv, listPurchases, SORT_FIELDS } from "@/services/purchases";

const tags = ["Compras"];

const SearchQuery = FiltersSchema.extend({
  q: z
    .string()
    .max(60)
    .optional()
    .openapi({ example: "jacket", description: "Busca en el producto" }),
  sort: sortSchema(SORT_FIELDS, "purchaseId:asc"),
});

const PurchaseSchema = z
  .object({
    purchaseId: z.number().int().openapi({ example: 1 }),
    customerId: z.number().int().openapi({ example: 1 }),
    itemName: z.string().openapi({ example: "Blouse" }),
    category: z.string().openapi({ example: "Clothing" }),
    amountUsd: z.number().openapi({ example: 53 }),
    season: z.string().openapi({ example: "Winter" }),
    size: z.string().openapi({ example: "L" }),
    color: z.string().openapi({ example: "Gray" }),
    reviewRating: z.number().openapi({ example: 3.1 }),
    promoUsed: z.boolean(),
    stateCode: z.string().openapi({ example: "KY" }),
    stateName: z.string().openapi({ example: "Kentucky" }),
    region: z.string().openapi({ example: "South" }),
    paymentMethod: z.string().openapi({ example: "Credit Card" }),
    shippingType: z.string().openapi({ example: "Express" }),
    gender: z.string().openapi({ example: "Male" }),
    age: z.number().int().openapi({ example: 55 }),
    ageBand: z.string().openapi({ example: "55-64" }),
    subscribed: z.boolean(),
    segment: z.string().openapi({ example: "Leales" }),
  })
  .openapi("Purchase");

const PurchasePageSchema = z
  .object({ data: z.array(PurchaseSchema), meta: PageMetaSchema })
  .openapi("PurchasePage");

export const purchasesRoutes = createRouter()
  .openapi(
    createRoute({
      method: "get",
      path: "/purchases",
      tags,
      summary: "Compras paginadas, ordenables y filtrables",
      request: { query: SearchQuery.extend(PaginationSchema.shape) },
      responses: { 200: jsonContent(PurchasePageSchema, "Página de compras"), ...errorResponses },
    }),
    async (c) => {
      const { page, pageSize, q, sort, ...filters } = c.req.valid("query");
      return c.json(await listPurchases(db, { filters, q, sort, page, pageSize }), 200);
    },
  )
  .openapi(
    createRoute({
      method: "get",
      path: "/purchases/export",
      tags,
      summary: "Exporta a CSV (streaming) las compras con los mismos filtros",
      request: { query: SearchQuery },
      responses: {
        200: {
          description: "Archivo CSV (UTF-8 con BOM)",
          content: { "text/csv": { schema: z.string().openapi({ format: "binary" }) } },
        },
        ...errorResponses,
      },
    }),
    (c) => {
      const { q, sort, ...filters } = c.req.valid("query");
      return c.body(exportPurchasesCsv(db, { filters, q, sort }), 200, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="compras.csv"',
        "Cache-Control": "no-store",
      });
    },
  );
