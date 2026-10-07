import type { SessionUser } from "./auth";
import { prisma } from "./db";

// Personal data must never reach the server logs. Prisma validation errors print
// the whole query (names, CIN, e-mails…), so their messages are never logged.
const SENSITIVE_KEY = /^(cin|password|pass|token|secret|email|phone|recipient|firstname|lastname|firstnamear|lastnamear|name|justification)$/i;

export function redactText(text: string) {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/\d{5,}/g, "[number]")
    .slice(0, 300);
}

export function describeError(error: unknown) {
  if (!(error instanceof Error)) return { name: typeof error };
  if (error.name.startsWith("PrismaClient")) {
    const known = error as Error & { code?: string; meta?: Record<string, unknown> };
    return {
      name: error.name,
      code: known.code,
      // Field and model names only, never values.
      target: known.meta?.target,
      model: known.meta?.modelName,
    };
  }
  return { name: error.name, message: redactText(error.message) };
}

export function logServerError(scope: string, error: unknown) {
  console.error(`[${scope}]`, JSON.stringify(describeError(error)));
}

export function safeDetails(details: Record<string, unknown> | undefined) {
  if (!details) return null;
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (SENSITIVE_KEY.test(key)) continue;
    if (value === undefined) continue;
    clean[key] = typeof value === "string" ? redactText(value) : value;
  }
  return JSON.stringify(clean).slice(0, 2000);
}

export type AuditAction =
  | "auth.login"
  | "auth.logout"
  | "auth.password_change"
  | "student.create"
  | "student.update"
  | "student.deactivate"
  | "student.view"
  | "students.import"
  | "students.emails_import"
  | "class.create"
  | "class.update"
  | "class.delete"
  | "user.create"
  | "user.update"
  | "user.deactivate"
  | "users.import"
  | "attendance.amend"
  | "attendance.record"
  | "justificatif.upload"
  | "justificatif.view"
  | "justificatif.delete"
  | "report.view"
  | "settings.update"
  | "threshold.update"
  | "threshold.delete"
  | "schedule.create"
  | "schedule.update"
  | "schedule.delete"
  | "schedule.import";

// Records who did what to which record. Never stores the sensitive values;
// `details` keeps counts and changed field names only. Never throws.
export async function audit(
  actor: Pick<SessionUser, "id" | "role"> | null,
  action: AuditAction,
  target?: { type: string; id?: string | null },
  details?: Record<string, unknown>,
  req?: Request,
) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: actor?.id ?? null,
        actorRole: actor?.role ?? null,
        action,
        targetType: target?.type ?? null,
        targetId: target?.id ?? null,
        details: safeDetails(details),
        ip: req ? clientIpOf(req) : null,
      },
    });
  } catch (error) {
    logServerError("audit", error);
  }
}

function clientIpOf(req: Request) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null
  );
}

// Names of the fields a request changed, for audit details (no values).
export function changedFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
) {
  return Object.keys(after).filter(
    (key) => after[key] !== undefined && (after[key] ?? null) !== (before[key] ?? null),
  );
}
