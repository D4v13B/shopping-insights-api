CREATE SCHEMA "analytics";
--> statement-breakpoint
CREATE SCHEMA "raw";
--> statement-breakpoint
CREATE SCHEMA "staging";
--> statement-breakpoint
CREATE TABLE "analytics"."dim_customer" (
	"customer_id" integer PRIMARY KEY NOT NULL,
	"age" smallint NOT NULL,
	"age_band" text NOT NULL,
	"gender" text NOT NULL,
	"subscribed" boolean NOT NULL,
	"previous_purchases" smallint NOT NULL,
	"lifetime_purchases" smallint NOT NULL,
	"frequency_label" text NOT NULL,
	"frequency_days" smallint NOT NULL,
	"purchases_per_year" numeric(6, 2) NOT NULL,
	"preferred_payment_method" text NOT NULL,
	"estimated_annual_value" numeric(10, 2) NOT NULL,
	"segment" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics"."dim_location" (
	"location_id" integer PRIMARY KEY NOT NULL,
	"state_name" text NOT NULL,
	"state_code" char(2) NOT NULL,
	"region" text NOT NULL,
	CONSTRAINT "dim_location_state_name_unique" UNIQUE("state_name"),
	CONSTRAINT "dim_location_state_code_unique" UNIQUE("state_code")
);
--> statement-breakpoint
CREATE TABLE "analytics"."dim_payment" (
	"payment_id" integer PRIMARY KEY NOT NULL,
	"payment_method" text NOT NULL,
	"shipping_type" text NOT NULL,
	CONSTRAINT "dim_payment_natural_key" UNIQUE("payment_method","shipping_type")
);
--> statement-breakpoint
CREATE TABLE "analytics"."dim_product" (
	"product_id" integer PRIMARY KEY NOT NULL,
	"item_name" text NOT NULL,
	"category" text NOT NULL,
	CONSTRAINT "dim_product_natural_key" UNIQUE("item_name","category")
);
--> statement-breakpoint
CREATE TABLE "analytics"."fact_purchase" (
	"purchase_id" integer PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"location_id" integer NOT NULL,
	"payment_id" integer NOT NULL,
	"season" text NOT NULL,
	"size" text NOT NULL,
	"color" text NOT NULL,
	"amount_usd" numeric(10, 2) NOT NULL,
	"review_rating" numeric(2, 1) NOT NULL,
	"promo_used" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "etl_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" text NOT NULL,
	"trigger" text NOT NULL,
	"source" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"rows_read" integer,
	"rows_valid" integer,
	"rows_rejected" integer,
	"duration_ms" integer,
	"error" text,
	"quality_report" jsonb,
	CONSTRAINT "etl_runs_status_check" CHECK ("etl_runs"."status" in ('requested', 'running', 'success', 'failed')),
	CONSTRAINT "etl_runs_trigger_check" CHECK ("etl_runs"."trigger" in ('startup', 'cli', 'api'))
);
--> statement-breakpoint
CREATE TABLE "raw"."shopping_trends" (
	"customer_id" text,
	"age" text,
	"gender" text,
	"item_purchased" text,
	"category" text,
	"purchase_amount_usd" text,
	"location" text,
	"size" text,
	"color" text,
	"season" text,
	"review_rating" text,
	"subscription_status" text,
	"payment_method" text,
	"shipping_type" text,
	"discount_applied" text,
	"promo_code_used" text,
	"previous_purchases" text,
	"preferred_payment_method" text,
	"frequency_of_purchases" text,
	"_run_id" uuid NOT NULL,
	"_loaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staging"."purchases" (
	"customer_id" integer PRIMARY KEY NOT NULL,
	"age" smallint NOT NULL,
	"age_band" text NOT NULL,
	"gender" text NOT NULL,
	"item_name" text NOT NULL,
	"category" text NOT NULL,
	"amount_usd" numeric(10, 2) NOT NULL,
	"state_name" text NOT NULL,
	"state_code" text NOT NULL,
	"region" text NOT NULL,
	"size" text NOT NULL,
	"color" text NOT NULL,
	"season" text NOT NULL,
	"review_rating" numeric(2, 1) NOT NULL,
	"subscribed" boolean NOT NULL,
	"payment_method" text NOT NULL,
	"shipping_type" text NOT NULL,
	"promo_used" boolean NOT NULL,
	"previous_purchases" smallint NOT NULL,
	"lifetime_purchases" smallint NOT NULL,
	"preferred_payment_method" text NOT NULL,
	"frequency_label" text NOT NULL,
	"frequency_days" smallint NOT NULL,
	"purchases_per_year" numeric(6, 2) NOT NULL,
	"estimated_annual_value" numeric(10, 2) NOT NULL,
	"segment" text NOT NULL,
	"_run_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staging"."rejected_rows" (
	"row_number" integer PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"errors" jsonb NOT NULL,
	"run_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics"."fact_purchase" ADD CONSTRAINT "fact_purchase_customer_id_dim_customer_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "analytics"."dim_customer"("customer_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics"."fact_purchase" ADD CONSTRAINT "fact_purchase_product_id_dim_product_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "analytics"."dim_product"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics"."fact_purchase" ADD CONSTRAINT "fact_purchase_location_id_dim_location_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "analytics"."dim_location"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics"."fact_purchase" ADD CONSTRAINT "fact_purchase_payment_id_dim_payment_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "analytics"."dim_payment"("payment_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fact_purchase_customer_idx" ON "analytics"."fact_purchase" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "fact_purchase_product_idx" ON "analytics"."fact_purchase" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "fact_purchase_location_idx" ON "analytics"."fact_purchase" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "fact_purchase_payment_idx" ON "analytics"."fact_purchase" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "fact_purchase_season_idx" ON "analytics"."fact_purchase" USING btree ("season");--> statement-breakpoint
CREATE INDEX "fact_purchase_product_season_idx" ON "analytics"."fact_purchase" USING btree ("product_id","season");