# 0016 · Tres repositorios: ETL, API y frontend

**Estado:** Aceptada · Reemplaza a [0012](0012-monorepo-bun-compose.md)

## Contexto
La entrega pide un repositorio por proyecto: código del ETL, de la API y del frontend, cada uno con
su README. Las tres piezas comparten dos cosas: el esquema de la base (lo define la API con Drizzle)
y el contrato OpenAPI (lo genera la API y lo consume la web).

## Opciones
1. **Tres repositorios; la API es dueña del esquema, de los roles y del Compose del stack completo.**
2. Un cuarto repositorio de infraestructura con el Compose y las migraciones: separa el esquema del
   código que lo modela con Drizzle y añade un repo que no pide la entrega.
3. Publicar el contrato como paquete npm: un registro y versiones para un solo consumidor.

## Decisión
- `shopping-insights-etl`: proyecto uv con su Dockerfile, el CSV de respaldo y sus tests.
- `shopping-insights-api`: API, esquema y migraciones Drizzle, `infra/postgres/init-roles.sh`, el
  contrato `openapi.json` y el `docker-compose.yml` que construye los tres repos clonados como
  carpetas hermanas (`ETL_REPO` y `WEB_REPO` permiten otra ubicación).
- `shopping-insights-web`: frontend con una copia versionada del contrato (`openapi.json`) y los
  tipos generados en `src/contract/`. `bun run sync:api` la actualiza desde la API.
- Cada repo tiene su CI. Los que necesitan la base (ETL y API) hacen checkout del otro repo para
  migrar y cargar datos.

## Consecuencias
- Cada proyecto se instala, prueba y construye por separado, con su propio lockfile.
- Un cambio de contrato son dos commits: la API regenera `openapi.json` y la web ejecuta
  `bun run sync:api`. El CI de la API falla si el contrato versionado no coincide con el código, y
  el de la web si los tipos no coinciden con su copia del contrato.
- Levantar todo sigue siendo un comando (`docker compose up --build` en el repo de la API), con los
  tres repos clonados uno al lado del otro.
