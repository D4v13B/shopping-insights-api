import { type SQL, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { mvSalesCube, vPurchases } from "@/db/schema";
import {
  chooseSource,
  column,
  type Dimension,
  type Filters,
  type Source,
  whereClause,
} from "@/lib/filters";

export interface Measures {
  revenue: number;
  orders: number;
  customers: number;
  avgTicket: number;
  avgRating: number;
  subscribedCustomers: number;
  promoOrders: number;
}

/** Medidas aditivas; los promedios se calculan como suma / órdenes (nunca se promedian promedios). */
function measures(source: Source): Record<keyof Measures, SQL<number>> {
  if (source === "cube") {
    const c = mvSalesCube;
    return {
      revenue: sql<number>`coalesce(sum(${c.revenue}), 0)::float8`,
      orders: sql<number>`coalesce(sum(${c.orders}), 0)::int`,
      customers: sql<number>`coalesce(sum(${c.customers}), 0)::int`,
      avgTicket: sql<number>`coalesce(round(sum(${c.revenue}) / nullif(sum(${c.orders}), 0), 2), 0)::float8`,
      avgRating: sql<number>`coalesce(round(sum(${c.ratingSum}) / nullif(sum(${c.orders}), 0), 2), 0)::float8`,
      subscribedCustomers: sql<number>`coalesce(sum(${c.customers}) filter (where ${c.subscribed}), 0)::int`,
      promoOrders: sql<number>`coalesce(sum(${c.orders}) filter (where ${c.promoUsed}), 0)::int`,
    };
  }
  const v = vPurchases;
  return {
    revenue: sql<number>`coalesce(sum(${v.amountUsd}), 0)::float8`,
    orders: sql<number>`count(*)::int`,
    customers: sql<number>`count(distinct ${v.customerId})::int`,
    avgTicket: sql<number>`coalesce(round(avg(${v.amountUsd}), 2), 0)::float8`,
    avgRating: sql<number>`coalesce(round(avg(${v.reviewRating}), 2), 0)::float8`,
    subscribedCustomers: sql<number>`(count(distinct ${v.customerId}) filter (where ${v.subscribed}))::int`,
    promoOrders: sql<number>`(count(*) filter (where ${v.promoUsed}))::int`,
  };
}

export type AggregateRow<D extends Dimension> = Measures & Record<D, string | boolean>;

/**
 * Agrega las medidas por las dimensiones pedidas aplicando los filtros. Usa el cubo cuando
 * filtros y agrupaciones caben en su grano; si no, el modelo estrella (v_purchases).
 * Ambas rutas dan el mismo resultado (hay un test que lo verifica).
 */
export async function aggregate<D extends Dimension>(
  db: Db,
  filters: Filters,
  groupBy: readonly D[] = [],
  forceSource?: Source,
): Promise<AggregateRow<D>[]> {
  const source = forceSource ?? chooseSource(filters, groupBy);
  const groupCols = groupBy.map((d) => column(d, source));
  const selection = {
    ...Object.fromEntries(groupBy.map((d, i) => [d, groupCols[i]])),
    ...measures(source),
  };
  const query = db
    .select(selection)
    .from(source === "cube" ? mvSalesCube : vPurchases)
    .where(whereClause(filters, source))
    .$dynamic();
  const rows = groupCols.length ? await query.groupBy(...groupCols) : await query;
  return rows as unknown as AggregateRow<D>[];
}
