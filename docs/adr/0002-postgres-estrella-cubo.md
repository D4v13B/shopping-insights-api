# 0002 · PostgreSQL con esquema estrella y cubo materializado

**Estado:** Aceptada

## Contexto
La carga es analítica: agregaciones con hasta 9 filtros combinables. Hay una sola fuente y un
volumen pequeño, pero el diseño debe escalar en la conversación técnica.

## Opciones
1. **PostgreSQL** con esquema estrella y vistas materializadas.
2. DuckDB embebido: excelente para OLAP, pero la API y el ETL corren en procesos separados y DuckDB
   no está pensado para escrituras y lecturas concurrentes desde varios servicios.
3. MongoDB: sin JOINs ni tipado fuerte; mal ajuste para un modelo dimensional.

## Decisión
PostgreSQL 18 con un esquema estrella (`fact_purchase` + 4 dimensiones) y un cubo materializado
(`mv_sales_cube`) al grano (categoría, temporada, género, rango de edad, región, suscrito,
promoción). El cubo guarda solo medidas **aditivas** (`revenue`, `orders`, `rating_sum`,
`customers`); los promedios se calculan al consultar.

## Consecuencias
- Cualquier combinación de filtros dentro del grano se resuelve sin tocar la tabla de hechos.
- Los filtros fuera del grano (`state`, `paymentMethod`, `segment`) van contra el modelo estrella
  (ver [0013](0013-vista-v-purchases.md)); un test verifica que ambas rutas coinciden.
- Las vistas se refrescan dentro de la transacción del ETL: los lectores nunca ven datos a medias.
- Con datos reales y volumen, el siguiente paso sería un motor columnar (ClickHouse o BigQuery) para
  la capa analítica.
