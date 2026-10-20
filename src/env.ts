import { z } from "zod";

/** Variables de entorno validadas al arrancar: si falta algo, el proceso termina de inmediato. */
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  DATABASE_URL_API: z.url({ protocol: /^postgres(ql)?$/ }),
  ETL_API_KEY: z.string().min(16, "ETL_API_KEY debe tener al menos 16 caracteres"),
  WEB_ORIGIN: z.url().default("http://localhost:3000"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  /** Si la web (SSR) envía este token en X-Internal-Token, sus peticiones no cuentan para el rate limit. */
  INTERNAL_API_TOKEN: z.string().min(16).optional(),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(100),
  ETL_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(10),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(
      JSON.stringify({
        level: "fatal",
        msg: "Variables de entorno inválidas",
        issues: z.flattenError(parsed.error).fieldErrors,
      }),
    );
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
