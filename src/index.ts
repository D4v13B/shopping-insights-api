import { createApp } from "@/app";
import { client } from "@/db/client";
import { env } from "@/env";
import { logger } from "@/lib/logger";

const app = createApp();
const server = Bun.serve({ port: env.PORT, fetch: app.fetch });
logger.info({ port: server.port }, "API escuchando");

async function shutdown(signal: string) {
  logger.info({ signal }, "apagando");
  await server.stop();
  await client.end({ timeout: 5 });
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
