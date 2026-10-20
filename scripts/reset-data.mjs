#!/usr/bin/env node
// Empties a database used for testing before going live: deletes every class,
// student, session, attendance, timetable, subject, level, programme and
// every NON-administrator account. Kept: administrator accounts, settings
// (absence rules) and the audit log. Uploaded justificatifs are deleted too.
//
//   sudo bash scripts/as-service.sh node scripts/reset-data.mjs          # shows what would be deleted
//   sudo bash scripts/as-service.sh node scripts/reset-data.mjs --yes    # deletes
//
// Take a backup first (scripts/db-backup.mjs): this cannot be undone.
import { PrismaClient } from "@prisma/client";
import { readdir, rm } from "node:fs/promises";
import path from "node:path";

const confirmed = process.argv.includes("--yes");
const prisma = new PrismaClient();
const uploadDir = process.env.UPLOAD_DIR;

const notAdmin = { role: { not: "ADMIN" } };
// Children before parents (Session/WeeklySlot block subject deletion).
const steps = [
  ["Pointages (présences)", prisma.attendance],
  ["Notifications d'absence", prisma.notificationLog],
  ["États d'alerte", prisma.alertState],
  ["Seuils d'absence", prisma.absenceThreshold],
  ["Séances", prisma.session],
  ["Cours hebdomadaires", prisma.weeklySlot],
  ["Semestres", prisma.academicPeriod],
  ["Jours fériés / vacances", prisma.dayOff],
  ["Programmes (matière × niveau)", prisma.subjectCurriculum],
  ["Étudiants", prisma.student],
  ["Classes", prisma.class],
  ["Matières", prisma.subject],
  ["Niveaux", prisma.academicLevel],
  ["Liens d'invitation (non-admin)", prisma.accountToken, { user: notAdmin }],
  ["Comptes enseignants / chefs", prisma.user, notAdmin],
];

async function uploadedFiles() {
  if (!uploadDir) return [];
  try {
    return await readdir(uploadDir);
  } catch {
    return [];
  }
}

try {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { email: true, active: true },
  });
  if (!admins.some((admin) => admin.active)) {
    console.error("reset-data: no active administrator, refusing (you would be locked out).");
    process.exit(1);
  }
  console.log(`Kept: ${admins.length} administrator account(s): ${admins.map((admin) => admin.email).join(", ")}`);
  console.log("Kept: settings, audit log.\n");

  const files = await uploadedFiles();
  for (const [label, model, where] of steps) {
    console.log(`${String(await model.count({ where })).padStart(7)}  ${label}`);
  }
  console.log(`${String(files.length).padStart(7)}  Fichiers justificatifs (${uploadDir ?? "UPLOAD_DIR non défini"})`);

  if (!confirmed) {
    console.log("\nNothing deleted. Run again with --yes to delete the above.");
    process.exit(0);
  }

  await prisma.$transaction(
    steps.map(([, model, where]) => model.deleteMany({ where })),
    { timeout: 120_000 },
  );
  for (const name of files) {
    await rm(path.join(uploadDir, name), { recursive: true, force: true });
  }
  console.log("\nDone: test data deleted. Administrator accounts kept.");
} catch (error) {
  console.error("reset-data failed, nothing was deleted from the database:", error?.message ?? error);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
