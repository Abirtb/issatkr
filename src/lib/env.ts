// Production configuration checks, run once at server start (src/instrumentation.ts).
// Fail fast instead of serving students' data with a weak or development setup.
// Messages name the variable, never its value.

export type ConfigIssue = { level: "error" | "warning"; message: string };

export function checkProductionConfig(env: NodeJS.ProcessEnv = process.env) {
  const issues: ConfigIssue[] = [];
  const error = (message: string) => issues.push({ level: "error", message });
  const warning = (message: string) => issues.push({ level: "warning", message });

  const secret = env.AUTH_SECRET ?? "";
  if (secret.length < 32 || /replace|generate|change|example|placeholder/i.test(secret)) {
    error("AUTH_SECRET must be a random value of at least 32 characters");
  }

  const db = env.DATABASE_URL ?? "";
  if (!db) error("DATABASE_URL is required");
  else if (!db.startsWith("file:")) error("DATABASE_URL must be a SQLite file: URL (see DEPLOYMENT.md)");
  else if (/dev\.db|test|seed/i.test(db)) {
    error("DATABASE_URL points to a development/test database; production needs its own file");
  }

  if (!env.UPLOAD_DIR) error("UPLOAD_DIR is required (persistent directory for justificatifs)");

  if (!env.CRON_SECRET || env.CRON_SECRET.length < 16) {
    warning("CRON_SECRET is not set (16+ characters): failed notification e-mails will not be retried");
  }
  if (!env.SMTP_FROM || (!env.SMTP_HOST && env.SMTP_TRANSPORT !== "json")) {
    warning("SMTP is not configured: warning/elimination e-mails will not be sent");
  }
  return issues;
}
