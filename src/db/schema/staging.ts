import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgSchema,
  smallint,
  text,
  uuid,
} from "drizzle-orm/pg-core";

export const staging = pgSchema("staging");

/** Filas válidas, limpias y tipadas: una por compra (y por cliente). */
export const stagingPurchases = staging.table("purchases", {
  customerId: integer("customer_id").primaryKey(),
  age: smallint("age").notNull(),
  ageBand: text("age_band").notNull(),
  gender: text("gender").notNull(),
  itemName: text("item_name").notNull(),
  category: text("category").notNull(),
  amountUsd: numeric("amount_usd", { precision: 10, scale: 2 }).notNull(),
  stateName: text("state_name").notNull(),
  stateCode: text("state_code").notNull(),
  region: text("region").notNull(),
  size: text("size").notNull(),
  color: text("color").notNull(),
  season: text("season").notNull(),
  reviewRating: numeric("review_rating", { precision: 2, scale: 1 }).notNull(),
  subscribed: boolean("subscribed").notNull(),
  paymentMethod: text("payment_method").notNull(),
  shippingType: text("shipping_type").notNull(),
  promoUsed: boolean("promo_used").notNull(),
  previousPurchases: smallint("previous_purchases").notNull(),
  lifetimePurchases: smallint("lifetime_purchases").notNull(),
  preferredPaymentMethod: text("preferred_payment_method").notNull(),
  frequencyLabel: text("frequency_label").notNull(),
  frequencyDays: smallint("frequency_days").notNull(),
  purchasesPerYear: numeric("purchases_per_year", { precision: 6, scale: 2 }).notNull(),
  estimatedAnnualValue: numeric("estimated_annual_value", { precision: 10, scale: 2 }).notNull(),
  segment: text("segment").notNull(),
  runId: uuid("_run_id").notNull(),
});

/** Filas que no pasaron la validación, con el motivo. Se truncan en cada carga. */
export const stagingRejectedRows = staging.table("rejected_rows", {
  rowNumber: integer("row_number").primaryKey(),
  payload: jsonb("payload").notNull(),
  errors: jsonb("errors").notNull(),
  runId: uuid("run_id").notNull(),
});
