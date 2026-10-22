#!/usr/bin/env node
// Consistent online backup of the SQLite database (safe while the app runs,
// WAL included) using SQLite's VACUUM INTO, followed by an integrity check of
// the copy. Prints file names and sizes only, never data or connection strings.
//
//   node scripts/db-backup.mjs [--dir /data/backups] [--keep 30]
import { PrismaClient } from "@prisma/client";
import { mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const dir = path.resolve(option("dir", process.env.BACKUP_DIR ?? "/data/backups"));
const keep = Number(option("keep", process.env.BACKUP_KEEP ?? "30"));

if (!process.env.DATABASE_URL?.startsWith("file:")) {
  console.error("db-backup: DATABASE_URL must be a SQLite file: URL");
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
const target = path.join(dir, `issatkr-${stamp}.db`);
mkdirSync(dir, { recursive: true, mode: 0o700 });

const source = new PrismaClient();
try {
  // Generated path, but quote-escaped anyway: VACUUM INTO takes a literal.
  await source.$executeRawUnsafe(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
} finally {
  await source.$disconnect();
}

const copy = new PrismaClient({ datasourceUrl: `file:${target}` });
try {
  const [row] = await copy.$queryRawUnsafe("PRAGMA integrity_check;");
  const result = Object.values(row)[0];
  if (result !== "ok") {
    console.error(`db-backup: integrity check FAILED for ${path.basename(target)}`);
    process.exit(2);
  }
} finally {
  await copy.$disconnect();
}
console.log(`db-backup: ${target} (${(statSync(target).size / 1024).toFixed(0)} KiB, integrity ok)`);

if (Number.isFinite(keep) && keep > 0) {
  const old = readdirSync(dir)
    .filter((file) => /^issatkr-\d{8}-\d{6}\.db$/.test(file))
    .sort()
    .slice(0, -keep);
  for (const file of old) unlinkSync(path.join(dir, file));
  if (old.length) console.log(`db-backup: removed ${old.length} backup(s) older than the last ${keep}`);
}
