# 0013 · Vista `v_purchases` para las consultas sobre la estrella

**Estado:** Aceptada (decidida durante la implementación)

## Contexto
Cuando los filtros no caben en el cubo, la API consulta la tabla de hechos unida a las 4
dimensiones. Al encapsular esos JOINs en una función genérica de Drizzle, se perdían los tipos de la
consulta.

## Opciones
1. **Vista SQL normal `analytics.v_purchases`** (hechos + dimensiones), declarada en Drizzle con
   `.existing()`.
2. Repetir los 4 JOINs en cada servicio.
3. SQL crudo sin tipos.

## Decisión
La vista se crea en la migración `0002`. Al ser una vista normal (no materializada), Postgres la
expande al planificar y sigue usando los índices de `fact_purchase`.

## Consecuencias
- Consultas tipadas y cortas (`db.select(...).from(vPurchases)`); el registro de dimensiones de los
  filtros apunta a sus columnas.
- `api_reader` solo necesita `SELECT` sobre la vista.
