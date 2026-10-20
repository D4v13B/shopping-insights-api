import { boolean, char, integer, numeric, smallint, text } from "drizzle-orm/pg-core";
import { analytics } from "./analytics";

// Vistas materializadas: las crea la migración SQL 0001; aquí solo se declaran para consultarlas
// con tipos (`.existing()` evita que drizzle-kit intente crearlas).

export const mvSalesCube = analytics
  .materializedView("mv_sales_cube", {
    category: text("category").notNull(),
    season: text("season").notNull(),
    gender: text("gender").notNull(),
    ageBand: text("age_band").notNull(),
    region: text("region").notNull(),
    subscribed: boolean("subscribed").notNull(),
    promoUsed: boolean("promo_used").notNull(),
    revenue: numeric("revenue").notNull(),
    orders: integer("orders").notNull(),
    ratingSum: numeric("rating_sum").notNull(),
    customers: integer("customers").notNull(),
  })
  .existing();

export const mvSalesByState = analytics
  .materializedView("mv_sales_by_state", {
    stateCode: char("state_code", { length: 2 }).notNull(),
    stateName: text("state_name").notNull(),
    region: text("region").notNull(),
    revenue: numeric("revenue").notNull(),
    orders: integer("orders").notNull(),
    ratingSum: numeric("rating_sum").notNull(),
    customers: integer("customers").notNull(),
  })
  .existing();

export const mvProductRanking = analytics
  .materializedView("mv_product_ranking", {
    productId: integer("product_id").notNull(),
    itemName: text("item_name").notNull(),
    category: text("category").notNull(),
    revenue: numeric("revenue").notNull(),
    orders: integer("orders").notNull(),
    ratingSum: numeric("rating_sum").notNull(),
  })
  .existing();

/** Hechos con sus dimensiones (vista normal, creada en la migración 0002). */
export const vPurchases = analytics
  .view("v_purchases", {
    purchaseId: integer("purchase_id").notNull(),
    customerId: integer("customer_id").notNull(),
    productId: integer("product_id").notNull(),
    itemName: text("item_name").notNull(),
    category: text("category").notNull(),
    amountUsd: numeric("amount_usd").notNull(),
    season: text("season").notNull(),
    size: text("size").notNull(),
    color: text("color").notNull(),
    reviewRating: numeric("review_rating").notNull(),
    promoUsed: boolean("promo_used").notNull(),
    stateCode: char("state_code", { length: 2 }).notNull(),
    stateName: text("state_name").notNull(),
    region: text("region").notNull(),
    paymentMethod: text("payment_method").notNull(),
    shippingType: text("shipping_type").notNull(),
    gender: text("gender").notNull(),
    age: smallint("age").notNull(),
    ageBand: text("age_band").notNull(),
    subscribed: boolean("subscribed").notNull(),
    segment: text("segment").notNull(),
    previousPurchases: smallint("previous_purchases").notNull(),
    estimatedAnnualValue: numeric("estimated_annual_value").notNull(),
  })
  .existing();
