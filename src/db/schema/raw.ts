import { pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const raw = pgSchema("raw");

/** Copia literal del CSV: todo en texto, sin validar. Solo se normalizan los nombres de columna. */
export const rawShoppingTrends = raw.table("shopping_trends", {
  customerId: text("customer_id"),
  age: text("age"),
  gender: text("gender"),
  itemPurchased: text("item_purchased"),
  category: text("category"),
  purchaseAmountUsd: text("purchase_amount_usd"),
  location: text("location"),
  size: text("size"),
  color: text("color"),
  season: text("season"),
  reviewRating: text("review_rating"),
  subscriptionStatus: text("subscription_status"),
  paymentMethod: text("payment_method"),
  shippingType: text("shipping_type"),
  discountApplied: text("discount_applied"),
  promoCodeUsed: text("promo_code_used"),
  previousPurchases: text("previous_purchases"),
  preferredPaymentMethod: text("preferred_payment_method"),
  frequencyOfPurchases: text("frequency_of_purchases"),
  runId: uuid("_run_id").notNull(),
  loadedAt: timestamp("_loaded_at", { withTimezone: true }).notNull().defaultNow(),
});
