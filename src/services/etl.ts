import { desc, eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { etlRuns } from "@/db/schema";
import { ConflictError, isUniqueViolation, NotFoundError } from "@/lib/errors";

export const ETL_CHANNEL = "etl_requested";

const runSelection = {
  id: etlRuns.id,
  status: etlRuns.status,
  trigger: etlRuns.trigger,
  source: etlRuns.source,
  requestedAt: etlRuns.requestedAt,
  startedAt: etlRuns.startedAt,
  finishedAt: etlRuns.finishedAt,
  rowsRead: etlRuns.rowsRead,
  rowsValid: etlRuns.rowsValid,
  rowsRejected: etlRuns.rowsRejected,
  durationMs: etlRuns.durationMs,
  error: etlRuns.error,
  qualityReport: etlRuns.qualityReport,
};

type RunRow = Awaited<ReturnType<typeof listRuns>>[number];

function serialize(run: RunRow) {
  return {
    ...run,
    requestedAt: run.requestedAt.toISOString(),
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    qualityReport: (run.qualityReport ?? null) as Record<string, unknown> | null,
  };
}

async function listRuns(db: Db, limit: number) {
  return db.select(runSelection).from(etlRuns).orderBy(desc(etlRuns.requestedAt)).limit(limit);
}

export async function getRuns(db: Db, limit: number) {
  return (await listRuns(db, limit)).map(serialize);
}

export async function getRun(db: Db, id: string) {
  const [run] = await db.select(runSelection).from(etlRuns).where(eq(etlRuns.id, id));
  if (!run) throw new NotFoundError(`No existe la ejecución ${id}`);
  return serialize(run);
}

/**
 * Registra la solicitud y avisa al worker en la misma transacción (el NOTIFY se entrega al hacer
 * commit). El índice único parcial de etl_runs convierte una segunda solicitud activa en 409.
 */
export async function requestRun(db: Db): Promise<{ id: string }> {
  try {
    return await db.transaction(async (tx) => {
      const [run] = await tx
        .insert(etlRuns)
        .values({ status: "requested", trigger: "api" })
        .returning({ id: etlRuns.id });
      if (!run) throw new Error("INSERT sin RETURNING");
      await tx.execute(sql`select pg_notify(${ETL_CHANNEL}, ${run.id})`);
      return run;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("Ya hay una ejecución del ETL solicitada o en curso");
    }
    throw error;
  }
}
