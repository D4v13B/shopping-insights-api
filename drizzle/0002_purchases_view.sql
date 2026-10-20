-- Vista (no materializada) del modelo estrella desnormalizado: la API la usa cuando los filtros
-- no caben en el cubo y para el explorador de compras. Postgres la expande al planificar, así que
-- los índices de fact_purchase se siguen usando.
CREATE VIEW "analytics"."v_purchases" AS
SELECT
  f.purchase_id,
  f.customer_id,
  f.product_id,
  p.item_name,
  p.category,
  f.amount_usd,
  f.season,
  f.size,
  f.color,
  f.review_rating,
  f.promo_used,
  l.state_code,
  l.state_name,
  l.region,
  pm.payment_method,
  pm.shipping_type,
  c.gender,
  c.age,
  c.age_band,
  c.subscribed,
  c.segment,
  c.previous_purchases,
  c.estimated_annual_value
FROM "analytics"."fact_purchase" f
JOIN "analytics"."dim_product" p USING (product_id)
JOIN "analytics"."dim_customer" c USING (customer_id)
JOIN "analytics"."dim_location" l USING (location_id)
JOIN "analytics"."dim_payment" pm USING (payment_id);
--> statement-breakpoint
GRANT SELECT ON "analytics"."v_purchases" TO api_reader;
