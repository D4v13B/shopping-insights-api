// Exporta el contrato OpenAPI sin levantar el servidor ni conectarse a la base.
process.env.DATABASE_URL_API ??= "postgresql://gen:gen@localhost:1/gen";
process.env.ETL_API_KEY ??= "generation-only-key-0000";
process.env.LOG_LEVEL ??= "silent";

const { openApiDocument } = await import("../src/app");
const out = new URL("../openapi.json", import.meta.url);
await Bun.write(out, `${JSON.stringify(openApiDocument(), null, 2)}\n`);
console.log(`OpenAPI escrito en ${out.pathname}`);
process.exit(0);
