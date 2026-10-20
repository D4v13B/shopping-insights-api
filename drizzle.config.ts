import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  schemaFilter: ["public", "raw", "staging", "analytics"],
  dbCredentials: {
    url:
      process.env.DATABASE_URL_MIGRATE ?? "postgresql://postgres:change-me@localhost:5432/shopping",
  },
  strict: true,
  verbose: true,
});
