# 0006 · Drizzle como único dueño del esquema

**Estado:** Aceptada

## Contexto
Dos lenguajes (TypeScript y Python) escriben y leen las mismas tablas. Si cada uno define el
esquema, se desincronizan.

## Opciones
1. **Drizzle** (en la API) define el esquema y genera las migraciones; el ETL solo escribe datos.
2. Alembic (en el ETL): la API quedaría sin tipos derivados del esquema.
3. SQL a mano: sin tipos en ningún lado.

## Decisión
`src/db/schema` (repo `shopping-insights-api`) es la fuente de verdad. drizzle-kit genera las migraciones. Lo que no modela
(vistas materializadas, el índice único parcial, la vista `v_purchases` y los `GRANT`) va en
migraciones SQL personalizadas versionadas junto a las demás. El servicio `migrate` las aplica como
dueño del esquema.

## Consecuencias
- Las consultas de la API están tipadas contra el esquema real, incluidas las vistas
  (`.existing()`).
- El ETL depende de los nombres de columna del esquema; los tests de integración del ETL fallan si
  divergen.
