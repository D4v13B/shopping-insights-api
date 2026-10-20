import { asc, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import {
  dimCustomer,
  dimLocation,
  dimPayment,
  dimProduct,
  mvProductRanking,
  mvSalesByState,
  vPurchases,
} from "@/db/schema";
import { AGE_BANDS, SEASONS, SEGMENTS } from "@/lib/domain";
import { type Filters, hasFilters, whereClause } from "@/lib/filters";
import { aggregate } from "./aggregate";

const pct = (part: number, total: number) => (total ? Math.round((part / total) * 10000) / 100 : 0);
const byOrder =
  <T>(order: readonly string[], key: (row: T) => string) =>
  (a: T, b: T) =>
    order.indexOf(key(a)) - order.indexOf(key(b));

export async function getFilterOptions(db: Db) {
  const [categories, genders, regions, states, payments] = await Promise.all([
    db.selectDistinct({ v: dimProduct.category }).from(dimProduct).orderBy(dimProduct.category),
    db.selectDistinct({ v: dimCustomer.gender }).from(dimCustomer).orderBy(dimCustomer.gender),
    db.selectDistinct({ v: dimLocation.region }).from(dimLocation).orderBy(dimLocation.region),
    db
      .select({ code: dimLocation.stateCode, name: dimLocation.stateName })
      .from(dimLocation)
      .orderBy(dimLocation.stateName),
    db
      .selectDistinct({ v: dimPayment.paymentMethod })
      .from(dimPayment)
      .orderBy(dimPayment.paymentMethod),
  ]);
  return {
    categories: categories.map((r) => r.v),
    seasons: [...SEASONS],
    genders: genders.map((r) => r.v),
    ageBands: [...AGE_BANDS],
    regions: regions.map((r) => r.v),
    states,
    paymentMethods: payments.map((r) => r.v),
  };
}

export async function getKpis(db: Db, filters: Filters) {
  const [row] = await aggregate(db, filters);
  if (!row) throw new Error("La agregación sin agrupar siempre devuelve una fila");
  return {
    revenue: row.revenue,
    orders: row.orders,
    customers: row.customers,
    avgTicket: row.avgTicket,
    avgRating: row.avgRating,
    subscribedPct: pct(row.subscribedCustomers, row.customers),
    promoPct: pct(row.promoOrders, row.orders),
  };
}

export async function getSalesByCategory(db: Db, filters: Filters) {
  const rows = await aggregate(db, filters, ["category"]);
  return rows
    .map((r) => ({
      category: String(r.category),
      revenue: r.revenue,
      orders: r.orders,
      avgTicket: r.avgTicket,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export async function getSalesBySeason(db: Db, filters: Filters) {
  const rows = await aggregate(db, filters, ["season", "category"]);
  return rows
    .map((r) => ({
      season: String(r.season),
      category: String(r.category),
      revenue: r.revenue,
      orders: r.orders,
    }))
    .sort(byOrder(SEASONS, (r) => r.season));
}

export const RANKING_METRICS = ["revenue", "orders", "rating"] as const;
export type RankingMetric = (typeof RANKING_METRICS)[number];

export async function getProductRanking(
  db: Db,
  filters: Filters,
  metric: RankingMetric,
  limit: number,
) {
  // Sin filtros, la vista materializada; con filtros, el modelo estrella.
  const rows = hasFilters(filters)
    ? await db
        .select({
          productId: vPurchases.productId,
          itemName: vPurchases.itemName,
          category: vPurchases.category,
          revenue: sql<number>`sum(${vPurchases.amountUsd})::float8`,
          orders: sql<number>`count(*)::int`,
          avgRating: sql<number>`round(avg(${vPurchases.reviewRating}), 2)::float8`,
        })
        .from(vPurchases)
        .where(whereClause(filters, "fact"))
        .groupBy(vPurchases.productId, vPurchases.itemName, vPurchases.category)
    : await db
        .select({
          productId: mvProductRanking.productId,
          itemName: mvProductRanking.itemName,
          category: mvProductRanking.category,
          revenue: sql<number>`${mvProductRanking.revenue}::float8`,
          orders: mvProductRanking.orders,
          avgRating: sql<number>`round(${mvProductRanking.ratingSum} / ${mvProductRanking.orders}, 2)::float8`,
        })
        .from(mvProductRanking);

  const key = { revenue: "revenue", orders: "orders", rating: "avgRating" } as const;
  return rows
    .sort((a, b) => b[key[metric]] - a[key[metric]] || a.itemName.localeCompare(b.itemName))
    .slice(0, limit)
    .map((row, index) => ({ rank: index + 1, ...row }));
}

export async function getSegments(db: Db, filters: Filters) {
  const v = vPurchases;
  const rows = await db
    .select({
      segment: v.segment,
      customers: sql<number>`count(distinct ${v.customerId})::int`,
      revenue: sql<number>`sum(${v.amountUsd})::float8`,
      avgTicket: sql<number>`round(avg(${v.amountUsd}), 2)::float8`,
      avgAnnualValue: sql<number>`round(avg(${v.estimatedAnnualValue}), 2)::float8`,
      avgPreviousPurchases: sql<number>`round(avg(${v.previousPurchases}), 1)::float8`,
    })
    .from(v)
    .where(whereClause(filters, "fact"))
    .groupBy(v.segment);
  const total = rows.reduce((sum, r) => sum + r.customers, 0);
  return rows
    .map((r) => ({ ...r, sharePct: pct(r.customers, total) }))
    .sort(byOrder(SEGMENTS, (r) => r.segment));
}

export async function getDemographics(db: Db, filters: Filters) {
  const [matrix, subscription] = await Promise.all([
    aggregate(db, filters, ["ageBand", "gender"]),
    aggregate(db, filters, ["subscribed", "gender"]),
  ]);
  return {
    matrix: matrix
      .map((r) => ({
        ageBand: String(r.ageBand),
        gender: String(r.gender),
        customers: r.customers,
        revenue: r.revenue,
        avgTicket: r.avgTicket,
      }))
      .sort(
        (a, b) =>
          AGE_BANDS.indexOf(a.ageBand as never) - AGE_BANDS.indexOf(b.ageBand as never) ||
          a.gender.localeCompare(b.gender),
      ),
    subscription: subscription
      .map((r) => ({
        subscribed: Boolean(r.subscribed),
        gender: String(r.gender),
        customers: r.customers,
        revenue: r.revenue,
        avgTicket: r.avgTicket,
        avgRating: r.avgRating,
      }))
      .sort(
        (a, b) => Number(b.subscribed) - Number(a.subscribed) || a.gender.localeCompare(b.gender),
      ),
  };
}

export async function getStates(db: Db, filters: Filters) {
  const allStates = await db
    .select({
      stateCode: dimLocation.stateCode,
      stateName: dimLocation.stateName,
      region: dimLocation.region,
    })
    .from(dimLocation)
    .orderBy(asc(dimLocation.stateName));

  const sales = hasFilters(filters)
    ? await db
        .select({
          stateCode: vPurchases.stateCode,
          revenue: sql<number>`sum(${vPurchases.amountUsd})::float8`,
          orders: sql<number>`count(*)::int`,
          avgTicket: sql<number>`round(avg(${vPurchases.amountUsd}), 2)::float8`,
        })
        .from(vPurchases)
        .where(whereClause(filters, "fact"))
        .groupBy(vPurchases.stateCode)
    : await db
        .select({
          stateCode: mvSalesByState.stateCode,
          revenue: sql<number>`${mvSalesByState.revenue}::float8`,
          orders: mvSalesByState.orders,
          avgTicket: sql<number>`round(${mvSalesByState.revenue} / ${mvSalesByState.orders}, 2)::float8`,
        })
        .from(mvSalesByState);

  // Los 50 estados siempre aparecen (el mapa los necesita), con 0 si el filtro los deja vacíos.
  const byCode = new Map(sales.map((s) => [s.stateCode, s]));
  return allStates
    .map((s) => {
      const hit = byCode.get(s.stateCode);
      return {
        ...s,
        revenue: hit?.revenue ?? 0,
        orders: hit?.orders ?? 0,
        avgTicket: hit?.avgTicket ?? 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue || a.stateName.localeCompare(b.stateName));
}
