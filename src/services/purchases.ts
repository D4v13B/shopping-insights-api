import { and, asc, desc, ilike, type SQL, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import type { Db } from "@/db/client";
import { client } from "@/db/client";
import { vPurchases as v } from "@/db/schema";
import { type Filters, whereClause } from "@/lib/filters";
import { pageMeta, parseSort } from "@/lib/pagination";

export const SORT_FIELDS = [
  "purchaseId",
  "itemName",
  "category",
  "amountUsd",
  "reviewRating",
  "season",
  "stateName",
  "age",
] as const;
export type SortField = (typeof SORT_FIELDS)[number];

const SORT_COLUMNS: Record<SortField, PgColumn> = {
  purchaseId: v.purchaseId,
  itemName: v.itemName,
  category: v.category,
  amountUsd: v.amountUsd,
  reviewRating: v.reviewRating,
  season: v.season,
  stateName: v.stateName,
  age: v.age,
};

const purchaseSelection = {
  purchaseId: v.purchaseId,
  customerId: v.customerId,
  itemName: v.itemName,
  category: v.category,
  amountUsd: sql<number>`${v.amountUsd}::float8`,
  season: v.season,
  size: v.size,
  color: v.color,
  reviewRating: sql<number>`${v.reviewRating}::float8`,
  promoUsed: v.promoUsed,
  stateCode: v.stateCode,
  stateName: v.stateName,
  region: v.region,
  paymentMethod: v.paymentMethod,
  shippingType: v.shippingType,
  gender: v.gender,
  age: v.age,
  ageBand: v.ageBand,
  subscribed: v.subscribed,
  segment: v.segment,
};

export interface PurchaseQuery {
  filters: Filters;
  q?: string;
  sort: string;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function purchaseWhere({ filters, q }: PurchaseQuery): SQL | undefined {
  const search = q?.trim() ? ilike(v.itemName, `%${escapeLike(q.trim())}%`) : undefined;
  return and(whereClause(filters, "fact"), search);
}

function purchaseOrder(sort: string): SQL[] {
  const { field, direction } = parseSort<SortField>(sort);
  const col = SORT_COLUMNS[field];
  // Desempate estable por purchase_id para que la paginación sea determinista.
  return [direction === "desc" ? desc(col) : asc(col), asc(v.purchaseId)];
}

function baseQuery(db: Db, query: PurchaseQuery) {
  return db
    .select(purchaseSelection)
    .from(v)
    .where(purchaseWhere(query))
    .orderBy(...purchaseOrder(query.sort));
}

export async function listPurchases(
  db: Db,
  query: PurchaseQuery & { page: number; pageSize: number },
) {
  const [data, [count]] = await Promise.all([
    baseQuery(db, query)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(v).where(purchaseWhere(query)),
  ]);
  return { data, meta: pageMeta(query.page, query.pageSize, count?.total ?? 0) };
}

export const CSV_COLUMNS = Object.keys(purchaseSelection) as (keyof typeof purchaseSelection)[];

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  // Neutraliza fórmulas (CSV injection) y escapa comillas, comas y saltos de línea.
  const safe = /^[=+\-@\t\r]/.test(text) && !/^-?\d/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** Genera el CSV fila a fila con un cursor del servidor: no carga todo en memoria. */
export function exportPurchasesCsv(db: Db, query: PurchaseQuery): ReadableStream<Uint8Array> {
  const { sql: text, params } = baseQuery(db, query).toSQL();
  const encoder = new TextEncoder();
  let iterator: AsyncIterator<unknown[][]> | undefined;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(`﻿${CSV_COLUMNS.join(",")}\n`));
      // .values(): filas como arrays en el orden de la selección (Drizzle no pone alias en el SQL).
      iterator = client
        .unsafe(text, params as never[])
        .values()
        .cursor(500)
        [Symbol.asyncIterator]() as AsyncIterator<unknown[][]>;
    },
    async pull(controller) {
      try {
        const next = await iterator?.next();
        if (!next || next.done) {
          controller.close();
          return;
        }
        const chunk = next.value.map((row) => row.map(csvCell).join(",")).join("\n");
        controller.enqueue(encoder.encode(`${chunk}\n`));
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() {
      await iterator?.return?.();
    },
  });
}
