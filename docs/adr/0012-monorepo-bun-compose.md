# 0012 · Monorepo con Bun workspaces y Docker Compose

**Estado:** Reemplazada por [0016](0016-tres-repositorios.md)

## Contexto
Tres aplicaciones (ETL, API, web) y un contrato compartido. El evaluador debe poder levantarlo todo
con un comando.

## Opciones
1. **Monorepo con Bun workspaces + Docker Compose.**
2. Repositorios separados: más ceremonia para compartir el contrato y versionar cambios cruzados.
3. Turborepo o Nx: útiles con muchos paquetes, de más para tres.

## Decisión
Un repositorio con `apps/api`, `apps/web`, `packages/shared` y `etl/` (proyecto uv aparte). Compose
ordena el arranque con healthchecks y `service_completed_successfully`:
`db → migrate → etl → api + etl-worker → web`.

## Consecuencias
- `cp .env.example .env && docker compose up --build` deja todo funcionando (unos 2 min la primera
  vez, unos 20 s después).
- Un cambio que cruza API y web va en un solo commit y lo valida un solo CI.
- El ETL es un servicio one-shot y el worker otro de larga vida: así la API puede esperar a que
  termine la carga inicial.
