-- Migración SQL personalizada: lo que drizzle-kit no modela.
-- 1) Una sola ejecución activa del ETL, garantizado por la base (sin condiciones de carrera).
CREATE UNIQUE INDEX "etl_runs_single_active_idx" ON "etl_runs" ((true))
  WHERE "status" IN ('requested', 'running');
--> statement-breakpoint
CREATE INDEX "etl_runs_requested_at_idx" ON "etl_runs" ("requested_at" DESC);
--> statement-breakpoint

-- 2) Cubo de ventas. Solo medidas ADITIVAS: los promedios se calculan al consultar
--    (avg_ticket = revenue / orders, avg_rating = rating_sum / orders).
CREATE MATERIALIZED VIEW "analytics"."mv_sales_cube" AS
SELECT
  p.category,
  f.season,
  c.gender,
  c.age_band,
  l.region,
  c.subscribed,
  f.promo_used,
  SUM(f.amount_usd)::numeric(12, 2) AS revenue,
  COUNT(*)::integer AS orders,
  SUM(f.review_rating)::numeric(12, 1) AS rating_sum,
  COUNT(DISTINCT f.customer_id)::integer AS customers
FROM "analytics"."fact_purchase" f
JOIN "analytics"."dim_product" p USING (product_id)
JOIN "analytics"."dim_customer" c USING (customer_id)
JOIN "analytics"."dim_location" l USING (location_id)
GROUP BY p.category, f.season, c.gender, c.age_band, l.region, c.subscribed, f.promo_used
WITH NO DATA;
--> statement-breakpoint
CREATE UNIQUE INDEX "mv_sales_cube_grain_idx" ON "analytics"."mv_sales_cube"
  (category, season, gender, age_band, region, subscribed, promo_used);
--> statement-breakpoint

-- 3) Ventas por estado, sin filtros (con filtros, la API consulta fact_purchase).
CREATE MATERIALIZED VIEW "analytics"."mv_sales_by_state" AS
SELECT
  l.state_code,
  l.state_name,
  l.region,
  SUM(f.amount_usd)::numeric(12, 2) AS revenue,
  COUNT(*)::integer AS orders,
  SUM(f.review_rating)::numeric(12, 1) AS rating_sum,
  COUNT(DISTINCT f.customer_id)::integer AS customers
FROM "analytics"."fact_purchase" f
JOIN "analytics"."dim_location" l USING (location_id)
GROUP BY l.state_code, l.state_name, l.region
WITH NO DATA;
--> statement-breakpoint
CREATE UNIQUE INDEX "mv_sales_by_state_idx" ON "analytics"."mv_sales_by_state" (state_code);
--> statement-breakpoint

-- 4) Ranking de productos, sin filtros.
CREATE MATERIALIZED VIEW "analytics"."mv_product_ranking" AS
SELECT
  p.product_id,
  p.item_name,
  p.category,
  SUM(f.amount_usd)::numeric(12, 2) AS revenue,
  COUNT(*)::integer AS orders,
  SUM(f.review_rating)::numeric(12, 1) AS rating_sum
FROM "analytics"."fact_purchase" f
JOIN "analytics"."dim_product" p USING (product_id)
GROUP BY p.product_id, p.item_name, p.category
WITH NO DATA;
--> statement-breakpoint
CREATE UNIQUE INDEX "mv_product_ranking_idx" ON "analytics"."mv_product_ranking" (product_id);
--> statement-breakpoint

-- 5) Mínimo privilegio. Los roles los crea infra/postgres/init-roles.sh.
--    etl_writer: escribe y trunca raw/staging/analytics, refresca las vistas (MAINTAIN, PG >= 17).
GRANT USAGE ON SCHEMA "raw", "staging", "analytics" TO etl_writer;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA "raw", "staging", "analytics" TO etl_writer;
--> statement-breakpoint
GRANT MAINTAIN ON "analytics"."mv_sales_cube", "analytics"."mv_sales_by_state", "analytics"."mv_product_ranking" TO etl_writer;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "etl_runs" TO etl_writer;
--> statement-breakpoint
--    api_reader: lee analytics y etl_runs; solo INSERTA solicitudes en etl_runs (no actualiza).
GRANT USAGE ON SCHEMA "analytics" TO api_reader;
--> statement-breakpoint
GRANT SELECT ON ALL TABLES IN SCHEMA "analytics" TO api_reader;
--> statement-breakpoint
GRANT SELECT, INSERT ON "etl_runs" TO api_reader;
--> statement-breakpoint
--    Tablas que creen migraciones futuras heredan los mismos permisos.
ALTER DEFAULT PRIVILEGES IN SCHEMA "raw", "staging", "analytics"
  GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLES TO etl_writer;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA "analytics" GRANT SELECT ON TABLES TO api_reader;
