# 0007 · Hono + zod-openapi en lugar de Elysia

**Estado:** Aceptada

## Contexto
La API debe validar la entrada, documentarse con OpenAPI y correr en Bun.

## Opciones
1. **Hono + `@hono/zod-openapi`**: estándar web (Request/Response), portable entre runtimes; Zod
   valida y genera el contrato a la vez.
2. Elysia: muy rápido y ergonómico en Bun, pero acoplado a Bun y con un ecosistema más chico.
3. Fastify: maduro, pero el contrato se escribe en JSON Schema aparte.

## Decisión
Hono con `createRoute` por endpoint. Un `defaultHook` convierte los errores de Zod en `422
application/problem+json`, y `app.request()` permite testear sin levantar el servidor.

## Consecuencias
- Un solo esquema por endpoint: imposible que la documentación y la validación diverjan.
- La misma app correría en Node, Deno o un edge runtime sin cambios.
