# 0014 · Versiones y runtimes fijados

**Estado:** Aceptada (decidida durante la implementación)

## Contexto
Al instalar las últimas versiones aparecieron tres incompatibilidades. Las versiones van fijadas en
los lockfiles (`bun.lock`, `uv.lock`) y en las imágenes de Docker.

## Decisiones

| Tema | Decisión | Motivo |
|---|---|---|
| TypeScript | **5.9.3** en la API y la web | TypeScript 7 (compilador nativo) no expone la API JS que necesita `openapi-typescript` (peer `^5`) |
| TanStack Table | **8.21.3** | La 9 salió hace dos meses con una API nueva; la 8 es estable y es la que usan los ejemplos de shadcn |
| Runtime de la web | **Node 24 + srvx** | Con Bun, `react-dom/server.bun` falla al cargar en `NODE_ENV=production`. TanStack Start soporta Node oficialmente y srvx es su servidor |
| Runtime de API y migraciones | Bun 1.3.11 | Sin problemas; ejecuta TypeScript sin paso de build |
| PostgreSQL | 18.1 | El privilegio `MAINTAIN` (PG ≥ 17) permite refrescar vistas sin ser su dueño |
| shadcn | CLI 4.22.1, plantilla `start`, preset `b3cVH8YREY` (estilo mira, Base UI, iconos Tabler) | El PRD decía `--template tanstack-start`; la CLI actual la llama `start` |

## Consecuencias
- La web y la API usan runtimes distintos en producción; cada repo fija sus versiones en su `bun.lock`.
- Hay que revisar estas restricciones al actualizar dependencias (TS 7 cuando `openapi-typescript`
  lo soporte, Table 9 cuando madure).
