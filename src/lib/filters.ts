import { z } from "@hono/zod-openapi";
import { and, eq, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { mvSalesCube, vPurchases } from "@/db/schema";
import { AGE_BANDS, BOOL_STRINGS, CATEGORIES, GENDERS, REGIONS, SEASONS } from "./domain";

/** Filtros comunes a todos los endpoints analíticos (query params opcionales). */
export const FiltersSchema = z.object({
  category: z.enum(CATEGORIES).optional().openapi({ example: "Clothing" }),
  season: z.enum(SEASONS).optional().openapi({ example: "Winter" }),
  gender: z.enum(GENDERS).optional(),
  ageBand: z.enum(AGE_BANDS).optional().openapi({ example: "25-34" }),
  region: z.enum(REGIONS).optional(),
  state: z
    .string()
    .regex(/^[A-Z]{2}$/, "Código USPS de 2 letras en mayúsculas")
    .optional()
    .openapi({ example: "TX", description: "Código USPS del estado" }),
  subscribed: z.enum(BOOL_STRINGS).optional(),
  promoUsed: z.enum(BOOL_STRINGS).optional(),
  paymentMethod: z
    .string()
    .min(1)
    .max(40)
    .optional()
    .openapi({ example: "PayPal", description: "Método de pago de la compra" }),
});

export type Filters = z.infer<typeof FiltersSchema>;

export type Source = "cube" | "fact";

interface DimensionColumns {
  cube?: PgColumn;
  fact: PgColumn;
}

/** Cada dimensión filtrable/agrupable y su columna en el cubo (si existe) y en el modelo estrella. */
export const DIMENSIONS = {
  category: { cube: mvSalesCube.category, fact: vPurchases.category },
  season: { cube: mvSalesCube.season, fact: vPurchases.season },
  gender: { cube: mvSalesCube.gender, fact: vPurchases.gender },
  ageBand: { cube: mvSalesCube.ageBand, fact: vPurchases.ageBand },
  region: { cube: mvSalesCube.region, fact: vPurchases.region },
  subscribed: { cube: mvSalesCube.subscribed, fact: vPurchases.subscribed },
  promoUsed: { cube: mvSalesCube.promoUsed, fact: vPurchases.promoUsed },
  state: { fact: vPurchases.stateCode },
  paymentMethod: { fact: vPurchases.paymentMethod },
  segment: { fact: vPurchases.segment },
} satisfies Record<string, DimensionColumns>;

export type Dimension = keyof typeof DIMENSIONS;

const DIMENSION_COLUMNS: Record<Dimension, DimensionColumns> = DIMENSIONS;

const BOOLEAN_FILTERS = new Set<keyof Filters>(["subscribed", "promoUsed"]);

function activeFilters(filters: Filters): [keyof Filters, string][] {
  return Object.entries(filters).filter(
    (entry): entry is [keyof Filters, string] => entry[1] !== undefined,
  );
}

export function hasFilters(filters: Filters): boolean {
  return activeFilters(filters).length > 0;
}

/** Regla de ruteo (PRD §6.2): el cubo sirve si todos los filtros y agrupaciones están en su grano. */
export function chooseSource(filters: Filters, groupBy: readonly Dimension[] = []): Source {
  const used = [...activeFilters(filters).map(([key]) => key), ...groupBy];
  return used.every((key) => DIMENSION_COLUMNS[key].cube !== undefined) ? "cube" : "fact";
}

export function column(dimension: Dimension, source: Source): PgColumn {
  const dim = DIMENSION_COLUMNS[dimension];
  const col = source === "cube" ? dim.cube : dim.fact;
  if (!col) throw new Error(`La dimensión ${dimension} no está en el cubo`);
  return col;
}

/** Traduce los filtros a condiciones parametrizadas de Drizzle para la fuente indicada. */
export function whereClause(filters: Filters, source: Source): SQL | undefined {
  const conditions = activeFilters(filters).map(([key, value]) =>
    eq(column(key, source), BOOLEAN_FILTERS.has(key) ? value === "true" : value),
  );
  return conditions.length ? and(...conditions) : undefined;
}
