import { checkProductionConfig } from "./lib/env";

export async function registerNode() {
  if (process.env.NODE_ENV !== "production") return;

  const issues = checkProductionConfig();
  for (const issue of issues) {
    console[issue.level === "error" ? "error" : "warn"](`[config] ${issue.level}: ${issue.message}`);
  }
  if (issues.some((issue) => issue.level === "error")) {
    // Throwing here is only logged by Next.js and the server keeps running;
    // exit so Docker/systemd report the failure instead of serving requests.
    console.error("[config] refusing to start: invalid production configuration");
    process.exit(1);
  }

  // WAL lets readers (reports, lists) proceed while attendance is being written.
  // The mode is stored in the database file, so this is idempotent.
  const { prisma } = await import("./lib/db");
  await prisma.$queryRawUnsafe("PRAGMA journal_mode=WAL;");
}
