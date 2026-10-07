#!/usr/bin/env node
// Checks that a database file (a backup, or the live one) is usable:
// SQLite integrity, applied migrations, and row COUNTS only (no personal data).
//
//   node scripts/db-verify.mjs /data/backups/issatkr-20261007-020000.db
//   node scripts/db-verify.mjs            # the DATABASE_URL database
import { PrismaClient } from "@prisma/client";
import { existsSync } from "node:fs";
import path from "node:path";

const file = process.argv[2];
if (file && !existsSync(file)) {
  console.error(`db-verify: file not found: ${path.basename(file)}`);
  process.exit(1);
}
const prisma = file
  ? new PrismaClient({ datasourceUrl: `file:${path.resolve(file)}` })
  : new PrismaClient();

try {
  const [integrity] = await prisma.$queryRawUnsafe("PRAGMA integrity_check;");
  const ok = Object.values(integrity)[0] === "ok";
  const migrations = await prisma.$queryRawUnsafe(
    'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY migration_name',
  );
  const counts = {
    users: await prisma.user.count(),
    activeAdmins: await prisma.user.count({ where: { role: "ADMIN", active: true } }),
    classes: await prisma.class.count(),
    students: await prisma.student.count(),
    sessions: await prisma.session.count(),
    attendances: await prisma.attendance.count(),
    auditEntries: await prisma.auditLog.count(),
  };
  console.log(`db-verify: integrity ${ok ? "ok" : "FAILED"}`);
  console.log(`db-verify: ${migrations.length} migrations applied, latest ${migrations.at(-1)?.migration_name ?? "none"}`);
  console.log(`db-verify: counts ${JSON.stringify(counts)}`);
  process.exit(ok ? 0 : 2);
} catch (error) {
  console.error(`db-verify: unreadable database (${error?.name ?? "error"})`);
  process.exit(2);
} finally {
  await prisma.$disconnect();
}
