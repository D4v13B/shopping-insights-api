import {
  boolean,
  char,
  index,
  integer,
  numeric,
  pgSchema,
  smallint,
  text,
  unique,
} from "drizzle-orm/pg-core";

export const analytics = pgSchema("analytics");

// Las surrogate keys las asigna el ETL de forma determinista (orden por clave natural),
// por eso las PK son integer y no serial.

export const dimCustomer = analytics.table("dim_customer", {
  customerId: integer("customer_id").primaryKey(),
  age: smallint("age").notNull(),
  ageBand: text("age_band").notNull(),
  gender: text("gender").notNull(),
  subscribed: boolean("subscribed").notNull(),
  previousPurchases: smallint("previous_purchases").notNull(),
  lifetimePurchases: smallint("lifetime_purchases").notNull(),
  frequencyLabel: text("frequency_label").notNull(),
  frequencyDays: smallint("frequency_days").notNull(),
  purchasesPerYear: numeric("purchases_per_year", { precision: 6, scale: 2 }).notNull(),
  preferredPaymentMethod: text("preferred_payment_method").notNull(),
  estimatedAnnualValue: numeric("estimated_annual_value", { precision: 10, scale: 2 }).notNull(),
  segment: text("segment").notNull(),
});

export const dimProduct = analytics.table(
  "dim_product",
  {
    productId: integer("product_id").primaryKey(),
    itemName: text("item_name").notNull(),
    category: text("category").notNull(),
  },
  (t) => [unique("dim_product_natural_key").on(t.itemName, t.category)],
);

/** También es la tabla de referencia de estados (50 filas, región Census). */
export const dimLocation = analytics.table("dim_location", {
  locationId: integer("location_id").primaryKey(),
  stateName: text("state_name").notNull().unique(),
  stateCode: char("state_code", { length: 2 }).notNull().unique(),
  region: text("region").notNull(),
});

export const dimPayment = analytics.table(
  "dim_payment",
  {
    paymentId: integer("payment_id").primaryKey(),
    paymentMethod: text("payment_method").notNull(),
    shippingType: text("shipping_type").notNull(),
  },
  (t) => [unique("dim_payment_natural_key").on(t.paymentMethod, t.shippingType)],
);

export const factPurchase = analytics.table(
  "fact_purchase",
  {
    // Cada fila del dataset es una compra de un cliente distinto: purchase_id = customer_id de origen.
    purchaseId: integer("purchase_id").primaryKey(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => dimCustomer.customerId),
    productId: integer("product_id")
      .notNull()
      .references(() => dimProduct.productId),
    locationId: integer("location_id")
      .notNull()
      .references(() => dimLocation.locationId),
    paymentId: integer("payment_id")
      .notNull()
      .references(() => dimPayment.paymentId),
    season: text("season").notNull(),
    size: text("size").notNull(),
    color: text("color").notNull(),
    amountUsd: numeric("amount_usd", { precision: 10, scale: 2 }).notNull(),
    reviewRating: numeric("review_rating", { precision: 2, scale: 1 }).notNull(),
    promoUsed: boolean("promo_used").notNull(),
  },
  (t) => [
    index("fact_purchase_customer_idx").on(t.customerId),
    index("fact_purchase_product_idx").on(t.productId),
    index("fact_purchase_location_idx").on(t.locationId),
    index("fact_purchase_payment_idx").on(t.paymentId),
    index("fact_purchase_season_idx").on(t.season),
    index("fact_purchase_product_season_idx").on(t.productId, t.season),
  ],
);
