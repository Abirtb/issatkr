import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, requireAdmin, authFailure } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { passwordProblem } from "@/lib/password-policy";
import { throttleUser } from "@/lib/rate-limit";
import { audit, logServerError } from "@/lib/security-log";
import {
  MAX_IMPORT_BYTES,
  parseTeacherRows,
  parseWorkbook,
} from "@/lib/parse-upload";

const MAX_TEACHERS = 500;
const emailSchema = z.string().email().max(200);

function generatePassword() {
  // Avoids look-alike characters so the password can be read aloud or printed.
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return [...randomBytes(10)].map((byte) => alphabet[byte % alphabet.length]).join("");
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const throttled = throttleUser(admin.id, "import");
    if (throttled) return throttled;
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Fichier requis" }, { status: 400 });
    }
    if (!/\.(csv|xlsx|xls)$/i.test(file.name)) {
      return NextResponse.json(
        { error: "Format accepté : CSV, XLSX ou XLS" },
        { status: 400 },
      );
    }
    if (file.size > MAX_IMPORT_BYTES) {
      return NextResponse.json(
        { error: "Fichier trop volumineux (maximum 5 Mo)" },
        { status: 413 },
      );
    }

    const rows = parseTeacherRows(parseWorkbook(await file.arrayBuffer()));
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Aucun enseignant trouvé. Colonnes attendues : nom, prenom, email" },
        { status: 400 },
      );
    }
    if (rows.length > MAX_TEACHERS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_TEACHERS} enseignants par import` },
        { status: 400 },
      );
    }

    const errors: string[] = [];
    const unique = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      if (!emailSchema.safeParse(row.email).success) {
        errors.push(`E-mail invalide : ${row.email}`);
      } else if (row.name.trim().length < 2) {
        errors.push(`Nom manquant : ${row.email}`);
      } else if (row.password && passwordProblem(row.password)) {
        errors.push(`${passwordProblem(row.password)} : ${row.email}`);
      } else {
        unique.set(row.email, row);
      }
    }

    const existing = await prisma.user.findMany({
      where: { email: { in: [...unique.keys()] } },
      select: { email: true, role: true },
    });
    const existingEmails = new Set(existing.map((user) => user.email));
    // Admin accounts are managed by hand only, so a spreadsheet can't demote or lock one out.
    for (const user of existing) {
      if (user.role !== "ADMIN") continue;
      unique.delete(user.email);
      errors.push(`Compte administrateur ignoré : ${user.email}`);
    }

    const credentials: { name: string; email: string; password: string }[] = [];
    let updated = 0;
    for (const row of unique.values()) {
      if (existingEmails.has(row.email)) {
        await prisma.user.update({
          where: { email: row.email },
          data: {
            name: row.name,
            ...(row.role ? { role: row.role } : {}),
            ...(row.password
              ? { password: await hashPassword(row.password) }
              : {}),
            active: true,
          },
        });
        updated++;
        continue;
      }
      const password = row.password || generatePassword();
      await prisma.user.create({
        data: {
          name: row.name,
          email: row.email,
          password: await hashPassword(password),
          role: row.role ?? "PROF",
        },
      });
      credentials.push({ name: row.name, email: row.email, password });
    }

    await audit(admin, "users.import", { type: "workbook", id: null }, { created: credentials.length, updated }, req);
    return NextResponse.json({
      created: credentials.length,
      updated,
      errors,
      credentials,
    });
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    logServerError("users.import", error);
    return NextResponse.json({ error: "Import des enseignants échoué" }, { status: 500 });
  }
}
