import { sql } from "drizzle-orm";
import { check, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const ETL_RUN_STATUSES = ["requested", "running", "success", "failed"] as const;
export type EtlRunStatus = (typeof ETL_RUN_STATUSES)[number];

export const ETL_RUN_TRIGGERS = ["startup", "cli", "api"] as const;

export const etlRuns = pgTable(
  "etl_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    status: text("status").$type<EtlRunStatus>().notNull(),
    trigger: text("trigger").$type<(typeof ETL_RUN_TRIGGERS)[number]>().notNull(),
    source: text("source"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    rowsRead: integer("rows_read"),
    rowsValid: integer("rows_valid"),
    rowsRejected: integer("rows_rejected"),
    durationMs: integer("duration_ms"),
    error: text("error"),
    qualityReport: jsonb("quality_report"),
  },
  (t) => [
    check(
      "etl_runs_status_check",
      sql`${t.status} in ('requested', 'running', 'success', 'failed')`,
    ),
    check("etl_runs_trigger_check", sql`${t.trigger} in ('startup', 'cli', 'api')`),
  ],
);
// El índice único parcial que garantiza una sola ejecución activa está en la migración SQL
// personalizada (drizzle-kit no soporta índices sobre expresiones constantes).
