import { describe, expect, test } from "bun:test";
import { db } from "@/db/client";
import { mvSalesCube, vPurchases } from "@/db/schema";
import { isUniqueViolation, ValidationError } from "@/lib/errors";
import { chooseSource, FiltersSchema, whereClause } from "@/lib/filters";
import { PaginationSchema, pageMeta, parseSort, sortSchema } from "@/lib/pagination";
import { isValidApiKey } from "@/middleware/api-key";
import { csvCell } from "@/services/purchases";

describe("chooseSource (ruteo cubo / estrella)", () => {
  test("sin filtros usa el cubo", () => {
    expect(chooseSource({})).toBe("cube");
  });
  test("filtros dentro del grano usan el cubo", () => {
    expect(chooseSource({ category: "Clothing", subscribed: "true" }, ["season"])).toBe("cube");
  });
  test.each([
    [{ state: "TX" }, []],
    [{ paymentMethod: "Cash" }, []],
    [{}, ["segment"]],
  ] as const)("%o agrupado por %o usa el modelo estrella", (filters, groupBy) => {
    expect(chooseSource(filters, groupBy)).toBe("fact");
  });
});

describe("whereClause", () => {
  test("sin filtros no genera WHERE", () => {
    expect(whereClause({}, "cube")).toBeUndefined();
  });
  test("parametriza los valores y convierte booleanos", () => {
    const query = db
      .select({ x: mvSalesCube.revenue })
      .from(mvSalesCube)
      .where(whereClause({ category: "Clothing", subscribed: "false" }, "cube"))
      .toSQL();
    expect(query.sql).toContain('"category" = $1');
    expect(query.sql).toContain('"subscribed" = $2');
    expect(query.params).toEqual(["Clothing", false]);
  });
  test("en el modelo estrella filtra por estado y método de pago", () => {
    const query = db
      .select({ x: vPurchases.amountUsd })
      .from(vPurchases)
      .where(whereClause({ state: "TX", paymentMethod: "Cash' OR 1=1 --" }, "fact"))
      .toSQL();
    expect(query.params).toEqual(["TX", "Cash' OR 1=1 --"]);
    expect(query.sql).not.toContain("OR 1=1");
  });
  test("un filtro fuera del grano no se puede aplicar al cubo", () => {
    expect(() => whereClause({ state: "TX" }, "cube")).toThrow();
  });
});

describe("FiltersSchema", () => {
  test("rechaza valores fuera de dominio", () => {
    expect(FiltersSchema.safeParse({ category: "Toys" }).success).toBe(false);
    expect(FiltersSchema.safeParse({ state: "tx" }).success).toBe(false);
    expect(FiltersSchema.safeParse({ subscribed: "yes" }).success).toBe(false);
  });
  test("acepta filtros válidos", () => {
    expect(FiltersSchema.parse({ ageBand: "65+", state: "NY" })).toEqual({
      ageBand: "65+",
      state: "NY",
    });
  });
});

describe("paginación y orden", () => {
  test("pageMeta calcula el total de páginas (mínimo 1)", () => {
    expect(pageMeta(1, 20, 3900)).toEqual({ page: 1, pageSize: 20, total: 3900, totalPages: 195 });
    expect(pageMeta(1, 20, 0).totalPages).toBe(1);
  });
  test("pageSize > 100 es inválido y los valores por defecto se aplican", () => {
    expect(PaginationSchema.safeParse({ pageSize: "101" }).success).toBe(false);
    expect(PaginationSchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });
  test("sort solo acepta la lista blanca", () => {
    const schema = sortSchema(["amountUsd", "age"] as const, "age:asc");
    expect(schema.parse(undefined)).toBe("age:asc");
    expect(schema.safeParse("amountUsd:desc").success).toBe(true);
    expect(schema.safeParse("password:asc").success).toBe(false);
    expect(schema.safeParse("age;drop table x:asc").success).toBe(false);
    expect(parseSort("amountUsd:desc")).toEqual({ field: "amountUsd", direction: "desc" });
  });
});

describe("errores", () => {
  test("detecta la violación de unicidad aunque venga envuelta", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation(new Error("x", { cause: { code: "23505" } }))).toBe(true);
    expect(isUniqueViolation(new Error("otro"))).toBe(false);
  });
  test("ValidationError es 422 con detalle por campo", () => {
    const error = new ValidationError([{ path: "page", message: "debe ser >= 1" }]);
    expect(error.status).toBe(422);
    expect(error.issues).toHaveLength(1);
  });
});

describe("API key", () => {
  test("compara de forma segura, incluso con longitudes distintas", () => {
    expect(isValidApiKey("test-api-key-0123456789")).toBe(true);
    expect(isValidApiKey("x")).toBe(false);
    expect(isValidApiKey(undefined)).toBe(false);
    expect(isValidApiKey("test-api-key-0123456780")).toBe(false);
  });
});

describe("csvCell", () => {
  test("escapa comillas, comas y saltos de línea", () => {
    expect(csvCell('Dice "hola", adiós')).toBe('"Dice ""hola"", adiós"');
    expect(csvCell("a\nb")).toBe('"a\nb"');
  });
  test("neutraliza fórmulas pero no números negativos", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell(-5)).toBe("-5");
  });
  test("null y undefined son celdas vacías", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });
});
