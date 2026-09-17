import { prisma } from "./db";

export const DEFAULT_ABSENCE_LIMIT = 3;

export async function getAbsenceLimit() {
  const row = await prisma.setting.findUnique({ where: { key: "absence_limit" } });
  const n = row ? Number(row.value) : DEFAULT_ABSENCE_LIMIT;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_ABSENCE_LIMIT;
}

export async function setAbsenceLimit(limit: number) {
  await prisma.setting.upsert({
    where: { key: "absence_limit" },
    create: { key: "absence_limit", value: String(limit) },
    update: { value: String(limit) },
  });
}
