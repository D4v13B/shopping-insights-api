// Aplica las migraciones de drizzle/ con el usuario dueño del esquema (DATABASE_URL_MIGRATE).
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL_MIGRATE;
if (!url) {
  console.error("DATABASE_URL_MIGRATE no está definida");
  process.exit(1);
}

const client = postgres(url, { max: 1, onnotice: () => {} });
try {
  await migrate(drizzle(client), {
    migrationsFolder: new URL("../drizzle", import.meta.url).pathname,
  });
  console.log(JSON.stringify({ level: "info", msg: "migraciones aplicadas" }));
} catch (error) {
  console.error(JSON.stringify({ level: "error", msg: "fallo al migrar", error: String(error) }));
  process.exitCode = 1;
} finally {
  await client.end();
}
