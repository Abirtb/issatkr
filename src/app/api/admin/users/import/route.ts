import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, requireAdmin, authFailure } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { passwordProblem } from "@/lib/password-policy";
import { unusablePassword } from "@/lib/account-tokens";
import { throttleUser } from "@/lib/rate-limit";
import { audit, logServerError } from "@/lib/security-log";
import {
  MAX_IMPORT_BYTES,
  parseTeacherWorkbook,
  personKey,
} from "@/lib/parse-upload";

const MAX_TEACHERS = 1000;
const emailSchema = z.string().email().max(200);

// Staff list import. The e-mail is optional: a list with names and grades only
// creates the teachers, and importing the same list later with an e-mail
// column completes them. A row matches an existing account by e-mail, else by
// name (case, accents and word order ignored). Nothing is ever e-mailed here.
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

    const rows = parseTeacherWorkbook(await file.arrayBuffer());
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Aucun enseignant trouvé. Colonne A : nom ; facultatif : grade, e-mail" },
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
      const label = row.email || row.name;
      if (row.email && !emailSchema.safeParse(row.email).success) {
        errors.push(`E-mail invalide : ${row.email}`);
      } else if (row.name.trim().length < 2) {
        errors.push(`Nom manquant : ${label}`);
      } else if (row.password && passwordProblem(row.password)) {
        errors.push(`${passwordProblem(row.password)} : ${label}`);
      } else {
        // The same person twice in the file (other case or word order): one
        // entry, keeping an e-mail / grade given on either line.
        const key = personKey(row.name);
        const previous = unique.get(key);
        unique.set(key, {
          ...row,
          email: row.email || previous?.email || "",
          grade: row.grade || previous?.grade || "",
        });
      }
    }

    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true },
    });
    const byEmail = new Map(users.filter((user) => user.email).map((user) => [user.email!, user]));
    const byName = new Map<string, (typeof users)[number] | null>();
    for (const user of users) {
      const key = personKey(user.name);
      // Two accounts with the same name: never guess which one.
      byName.set(key, byName.has(key) ? null : user);
    }

    // One hash for every new account without password: nobody knows it, and
    // hashing hundreds of random passwords would take minutes.
    const placeholderHash = await hashPassword(unusablePassword());
    let awaitingInvitation = 0;
    let withoutEmail = 0;
    let created = 0;
    let updated = 0;
    for (const row of unique.values()) {
      const existing =
        (row.email ? byEmail.get(row.email) : undefined) ?? byName.get(personKey(row.name)) ?? undefined;
      const label = row.email || row.name;
      // Admin accounts are managed by hand only, so a spreadsheet can't demote or lock one out.
      if (existing?.role === "ADMIN") {
        errors.push(`Compte administrateur ignoré : ${label}`);
        continue;
      }
      const emailOwner = row.email ? byEmail.get(row.email) : undefined;
      if (emailOwner && existing && emailOwner.id !== existing.id) {
        errors.push(`E-mail déjà utilisé par ${emailOwner.name} : ${row.email}`);
        continue;
      }

      if (existing) {
        const data = {
          name: row.name,
          active: true,
          ...(row.grade ? { grade: row.grade } : {}),
          ...(row.role ? { role: row.role } : {}),
          ...(row.email ? { email: row.email } : {}),
          ...(row.password
            ? { password: await hashPassword(row.password), awaitingActivation: false }
            : {}),
        };
        await prisma.user.update({ where: { id: existing.id }, data });
        if (row.email) byEmail.set(row.email, existing);
        if (!row.email && !existing.email) withoutEmail++;
        updated++;
        continue;
      }
      const user = await prisma.user.create({
        data: {
          name: row.name,
          email: row.email || null,
          grade: row.grade || null,
          password: row.password ? await hashPassword(row.password) : placeholderHash,
          role: row.role ?? "PROF",
          awaitingActivation: !row.password,
        },
        select: { id: true, email: true, name: true, role: true },
      });
      if (user.email) byEmail.set(user.email, user);
      byName.set(personKey(user.name), user);
      created++;
      if (!row.password) awaitingInvitation++;
      if (!row.email) withoutEmail++;
    }

    await audit(admin, "users.import", { type: "workbook", id: null }, { created, updated, awaitingInvitation, withoutEmail }, req);
    return NextResponse.json({
      created,
      updated,
      errors,
      awaitingInvitation,
      withoutEmail,
    });
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    logServerError("users.import", error);
    return NextResponse.json({ error: "Import des enseignants échoué" }, { status: 500 });
  }
}
