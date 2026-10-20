import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/env";
import * as schema from "./schema";

export const client = postgres(env.DATABASE_URL_API, {
  max: 10,
  idle_timeout: 30,
  onnotice: () => {},
});

export const db = drizzle(client, { schema });

export type Db = typeof db;
