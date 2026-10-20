import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export const PROBLEM_CONTENT_TYPE = "application/problem+json";

export interface FieldIssue {
  path: string;
  message: string;
}

/** Error de dominio que se traduce a un problem+json (RFC 9457). */
export class AppError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly slug: string,
    readonly title: string,
    detail?: string,
    readonly issues?: FieldIssue[],
  ) {
    super(detail ?? title);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  constructor(detail = "El recurso solicitado no existe") {
    super(404, "not-found", "Recurso no encontrado", detail);
  }
}

export class ValidationError extends AppError {
  constructor(issues: FieldIssue[], detail = "Uno o más parámetros no son válidos") {
    super(422, "validation-error", "Parámetros inválidos", detail, issues);
  }
}

export class UnauthorizedError extends AppError {
  constructor(detail = "Falta la cabecera X-API-Key o no es válida") {
    super(401, "unauthorized", "No autorizado", detail);
  }
}

export class ConflictError extends AppError {
  constructor(detail: string) {
    super(409, "conflict", "Conflicto", detail);
  }
}

export class TooManyRequestsError extends AppError {
  constructor() {
    super(
      429,
      "rate-limited",
      "Demasiadas solicitudes",
      "Se superó el límite de solicitudes por minuto",
    );
  }
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance: string;
  requestId?: string;
  errors?: FieldIssue[];
}

export function toProblem(c: Context, error: AppError): ProblemDetails {
  return {
    type: `urn:shopping-insights:problem:${error.slug}`,
    title: error.title,
    status: error.status,
    detail: error.message,
    instance: c.req.path,
    requestId: c.get("requestId"),
    ...(error.issues ? { errors: error.issues } : {}),
  };
}

export function problemResponse(c: Context, error: AppError): Response {
  return c.newResponse(JSON.stringify(toProblem(c, error)), error.status, {
    "Content-Type": PROBLEM_CONTENT_TYPE,
  });
}

/** El índice único parcial de etl_runs (o cualquier unique) viola con código 23505. */
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; current && depth < 3; depth++) {
    if (typeof current === "object" && "code" in current && current.code === "23505") return true;
    current = typeof current === "object" && "cause" in current ? current.cause : undefined;
  }
  return false;
}
