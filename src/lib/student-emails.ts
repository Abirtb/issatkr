import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { normalizeCin, type CinEmailRow } from "./parse-upload";

const emailSchema = z.string().email().max(200);

export type EmailMergeResult = {
  updated: number;
  unchanged: number;
  notFound: string[];
  invalid: string[];
};

// Fills student e-mails from a second file, matching students by CIN.
export async function applyEmailsByCin(
  tx: Prisma.TransactionClient,
  rows: CinEmailRow[],
): Promise<EmailMergeResult> {
  const byCin = new Map<string, CinEmailRow>();
  const invalid: string[] = [];
  for (const row of rows) {
    if (!emailSchema.safeParse(row.email).success) {
      invalid.push(`${row.cin}${row.name ? ` (${row.name})` : ""} : ${row.email}`);
      continue;
    }
    byCin.set(normalizeCin(row.cin), row);
  }

  const students = await tx.student.findMany({
    where: { cin: { not: null } },
    select: { id: true, cin: true, email: true },
  });
  const matched = new Set<string>();
  let updated = 0;
  let unchanged = 0;
  for (const student of students) {
    const key = normalizeCin(student.cin ?? "");
    const row = byCin.get(key);
    if (!row) continue;
    matched.add(key);
    if (student.email === row.email) {
      unchanged++;
      continue;
    }
    await tx.student.update({
      where: { id: student.id },
      data: { email: row.email },
    });
    updated++;
  }

  return {
    updated,
    unchanged,
    invalid,
    notFound: [...byCin.entries()]
      .filter(([key]) => !matched.has(key))
      .map(([, row]) => `${row.cin}${row.name ? ` (${row.name})` : ""}`),
  };
}
