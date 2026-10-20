import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { db } from "@/db/client";
import { aggregate } from "@/services/aggregate";
import { API_KEY, get, hasDatabase, post } from "./helpers";

// Requiere una base migrada con el ETL ejecutado (3,900 compras).
describe.skipIf(!hasDatabase)("API contra PostgreSQL", () => {
  // api_reader no puede borrar en etl_runs (mínimo privilegio): la limpieza usa el usuario admin.
  const adminUrl = process.env.TEST_DATABASE_URL_ADMIN;
  const clearActiveRuns = async () => {
    if (!adminUrl) return;
    const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
    await admin`delete from etl_runs where trigger = 'api' and status in ('requested', 'running')`;
    await admin.end();
  };

  beforeAll(async () => {
    await clearActiveRuns();
    const [active] = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from etl_runs where status in ('requested', 'running')`,
    );
    if (active?.n) throw new Error("Hay una ejecución activa en etl_runs: el POST daría 409");
  });
  afterAll(clearActiveRuns);

  test("GET /health", async () => {
    const res = await get("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok", database: "up" });
  });

  test("GET /openapi.json documenta todos los endpoints", async () => {
    const doc = (await (await get("/openapi.json")).json()) as { paths: Record<string, unknown> };
    expect(Object.keys(doc.paths)).toHaveLength(14);
  });

  test("GET /kpis sin filtros cuadra con el dataset", async () => {
    const res = await get("/api/v1/kpis");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      revenue: 233081,
      orders: 3900,
      customers: 3900,
      avgTicket: 59.76,
      avgRating: 3.75,
      subscribedPct: 27,
      promoPct: 43,
    });
  });

  test("GET /kpis con filtro fuera del cubo usa el modelo estrella", async () => {
    const body = (await (await get("/api/v1/kpis?state=TX&paymentMethod=Cash")).json()) as {
      orders: number;
    };
    expect(body.orders).toBeGreaterThan(0);
    expect(body.orders).toBeLessThan(3900);
  });

  test.each([
    [{}, []],
    [{ category: "Clothing" }, ["season"]],
    [{ gender: "Female", subscribed: "false" }, ["ageBand", "gender"]],
    [{ region: "West", promoUsed: "true" }, ["category"]],
  ] as const)("cubo y estrella dan el mismo resultado (%o, %o)", async (filters, groupBy) => {
    const sortRows = (rows: object[]) => rows.map((r) => JSON.stringify(r)).sort();
    const cube = await aggregate(db, filters, groupBy, "cube");
    const fact = await aggregate(db, filters, groupBy, "fact");
    expect(sortRows(cube)).toEqual(sortRows(fact));
  });

  test("las mujeres no tienen suscripción (sesgo del dataset)", async () => {
    const body = (await (await get("/api/v1/kpis?gender=Female")).json()) as {
      subscribedPct: number;
    };
    expect(body.subscribedPct).toBe(0);
  });

  test.each([
    "/api/v1/filters/options",
    "/api/v1/sales/by-category?season=Fall",
    "/api/v1/sales/by-season",
    "/api/v1/products/ranking?metric=orders&limit=5",
    "/api/v1/products/ranking?metric=rating&category=Footwear",
    "/api/v1/customers/segments?region=South",
    "/api/v1/customers/demographics",
    "/api/v1/geo/states?ageBand=65%2B",
  ])("GET %s responde 200", async (path) => {
    const res = await get(path);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  test("ranking respeta el límite y ordena por la métrica", async () => {
    const rows = (await (await get("/api/v1/products/ranking?limit=5")).json()) as {
      rank: number;
      revenue: number;
    }[];
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5]);
    expect([...rows].sort((a, b) => b.revenue - a.revenue)).toEqual(rows);
  });

  test("geo/states siempre devuelve los 50 estados", async () => {
    const rows = (await (
      await get("/api/v1/geo/states?category=Outerwear&season=Summer")
    ).json()) as unknown[];
    expect(rows).toHaveLength(50);
  });

  test("segmentos: los cinco suman el total de clientes", async () => {
    const rows = (await (await get("/api/v1/customers/segments")).json()) as {
      segment: string;
      customers: number;
    }[];
    expect(rows.map((r) => r.segment)).toEqual([
      "Campeones",
      "Leales",
      "En riesgo",
      "Potenciales",
      "Ocasionales",
    ]);
    expect(rows.reduce((s, r) => s + r.customers, 0)).toBe(3900);
  });

  describe("GET /purchases", () => {
    test("pagina, ordena y busca", async () => {
      const res = await get("/api/v1/purchases?page=2&pageSize=5&sort=amountUsd:desc&q=Coat");
      const body = (await res.json()) as {
        data: { itemName: string; amountUsd: number }[];
        meta: { page: number; total: number; totalPages: number };
      };
      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(5);
      expect(body.data.every((p) => p.itemName === "Coat")).toBe(true);
      expect(body.meta.page).toBe(2);
      expect(body.meta.totalPages).toBe(Math.ceil(body.meta.total / 5));
    });

    test("la última página puede venir incompleta", async () => {
      const body = (await (await get("/api/v1/purchases?page=196&pageSize=20")).json()) as {
        data: unknown[];
        meta: { totalPages: number };
      };
      expect(body.meta.totalPages).toBe(195);
      expect(body.data).toHaveLength(0);
      const last = (await (await get("/api/v1/purchases?page=195&pageSize=20")).json()) as {
        data: unknown[];
      };
      expect(last.data).toHaveLength(20);
    });

    test("los comodines de LIKE se escapan", async () => {
      const body = (await (await get("/api/v1/purchases?q=%25")).json()) as {
        meta: { total: number };
      };
      expect(body.meta.total).toBe(0);
    });

    test.each([
      "pageSize=101",
      "page=0",
      "sort=password:asc",
      "sort=amountUsd:sideways",
      "category=Toys",
    ])("%s → 422 problem+json", async (qs) => {
      const res = await get(`/api/v1/purchases?${qs}`);
      expect(res.status).toBe(422);
      expect(res.headers.get("content-type")).toBe("application/problem+json");
      const body = (await res.json()) as { errors: unknown[]; requestId: string };
      expect(body.errors.length).toBeGreaterThan(0);
      expect(body.requestId).toBeTruthy();
    });
  });

  test("GET /purchases/export devuelve CSV con los mismos filtros", async () => {
    const res = await get("/api/v1/purchases/export?category=Outerwear");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("compras.csv");
    const lines = (await res.text()).trim().split("\n");
    expect(lines).toHaveLength(325); // 324 compras de Outerwear + encabezado
    expect(lines[1]).toContain(",Outerwear,");
  });

  describe("ETL", () => {
    test("POST /etl/run sin clave → 401", async () => {
      const res = await post("/api/v1/etl/run");
      expect(res.status).toBe(401);
      expect(res.headers.get("content-type")).toBe("application/problem+json");
    });

    test("POST /etl/run con clave inválida → 401", async () => {
      expect((await post("/api/v1/etl/run", { "X-API-Key": "nope" })).status).toBe(401);
    });

    test("POST /etl/run → 202 con Location; el segundo → 409", async () => {
      const first = await post("/api/v1/etl/run", { "X-API-Key": API_KEY });
      expect(first.status).toBe(202);
      const { id } = (await first.json()) as { id: string };
      expect(first.headers.get("location")).toBe(`/api/v1/etl/runs/${id}`);

      const second = await post("/api/v1/etl/run", { "X-API-Key": API_KEY });
      expect(second.status).toBe(409);

      const run = await get(`/api/v1/etl/runs/${id}`);
      expect(run.status).toBe(200);
      expect(await run.json()).toMatchObject({ id, trigger: "api" });
    });

    test("GET /etl/runs lista las ejecuciones", async () => {
      const runs = (await (await get("/api/v1/etl/runs?limit=5")).json()) as unknown[];
      expect(runs.length).toBeGreaterThan(0);
    });

    test("GET /etl/runs/{id} inexistente → 404 y id mal formado → 422", async () => {
      expect((await get("/api/v1/etl/runs/00000000-0000-4000-8000-000000000000")).status).toBe(404);
      expect((await get("/api/v1/etl/runs/no-es-uuid")).status).toBe(422);
    });
  });

  test("ruta inexistente → 404 problem+json", async () => {
    const res = await get("/api/v1/nada");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toBe("application/problem+json");
  });

  test("cabeceras de seguridad y CORS", async () => {
    const res = await get("/api/v1/kpis", { Origin: "http://localhost:3000" });
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
    expect(res.headers.get("x-request-id")).toBeTruthy();
    const evil = await get("/api/v1/kpis", { Origin: "https://evil.example" });
    expect(evil.headers.get("access-control-allow-origin")).toBeNull();
  });

  test("el rol api_reader no puede escribir en analytics", async () => {
    let error: unknown;
    try {
      await db.execute(sql`delete from analytics.dim_location`);
    } catch (e) {
      error = e;
    }
    expect(String((error as { cause?: unknown })?.cause ?? error)).toContain("permission denied");
  });
});
