import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, requireAdmin, authFailure } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { newPasswordField } from "@/lib/password-policy";
import { audit } from "@/lib/security-log";
import { unusablePassword } from "@/lib/account-tokens";

const roleSchema = z.enum(["ADMIN", "DEPARTMENT_HEAD", "PROF"]);
// Optional for teachers (added later, then the invitation); "" or null = none.
const optionalEmail = z
  .union([z.string().trim().toLowerCase().email().max(200), z.literal(""), z.null()])
  .optional()
  .transform((value) => value || null);
const grade = z
  .string()
  .trim()
  .max(80)
  .nullable()
  .optional()
  .transform((value) => value || null);
// Administrators always log in with an e-mail.
const adminNeedsEmail = (value: { role: string; email: string | null }) =>
  value.role !== "ADMIN" || Boolean(value.email);
const adminEmailMessage = { message: "Un administrateur doit avoir une adresse e-mail" };
const createSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: optionalEmail,
    grade,
    // Empty or absent: the account waits for an invitation, sent separately.
    password: z.union([newPasswordField, z.literal("")]).optional(),
    role: roleSchema,
  })
  .refine(adminNeedsEmail, adminEmailMessage);
const updateSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(2).max(100),
    email: optionalEmail,
    grade,
    role: roleSchema,
    active: z.boolean(),
    password: z.union([newPasswordField, z.literal("")]).optional(),
  })
  .refine(adminNeedsEmail, adminEmailMessage);

const selection = {
  id: true,
  name: true,
  email: true,
  grade: true,
  role: true,
  active: true,
  createdAt: true,
  _count: { select: { taughtSessions: true, weeklySlots: true } },
} as const;

// For accounts without a password yet: "not_sent" (no invitation sent so far),
// "pending" (a link is still valid) or "expired".
function invitationStatus(
  awaitingActivation: boolean,
  tokens: { purpose: string; usedAt: Date | null; expiresAt: Date }[],
) {
  if (!awaitingActivation) return null;
  const invites = tokens.filter((token) => token.purpose === "INVITE");
  if (!invites.length) return "not_sent";
  return invites.some((token) => !token.usedAt && token.expiresAt > new Date()) ? "pending" : "expired";
}

export async function GET() {
  try {
    await requireAdmin();
    const users = await prisma.user.findMany({
      select: {
        ...selection,
        awaitingActivation: true,
        accountTokens: { select: { purpose: true, usedAt: true, expiresAt: true } },
      },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });
    return NextResponse.json(
      users.map(({ accountTokens, awaitingActivation, ...user }) => ({
        ...user,
        invitation: invitationStatus(awaitingActivation, accountTokens),
      })),
    );
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const input = createSchema.parse(await req.json());
    // No password: nothing is sent now, the admin sends the invitation later.
    const awaitingActivation = !input.password;
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        grade: input.grade,
        password: await hashPassword(input.password || unusablePassword()),
        role: input.role,
        awaitingActivation,
      },
      select: selection,
    });
    await audit(admin, "user.create", { type: "user", id: user.id }, { role: user.role, awaitingActivation }, req);
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message
        : "E-mail déjà utilisé ou données invalides";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    const admin = await requireAdmin();
    const input = updateSchema.parse(await req.json());
    if (input.id === admin.id && !input.active) {
      return NextResponse.json(
        { error: "Vous ne pouvez pas désactiver votre propre compte" },
        { status: 400 },
      );
    }
    // Self-deactivation is refused above, so only a self-demotion can leave the
    // school without any administrator.
    if (input.id === admin.id && input.role !== "ADMIN") {
      const otherAdmins = await prisma.user.count({
        where: { role: "ADMIN", active: true, id: { not: admin.id } },
      });
      if (otherAdmins === 0) {
        return NextResponse.json(
          { error: "Impossible : vous êtes le dernier administrateur actif" },
          { status: 400 },
        );
      }
    }
    const user = await prisma.user.update({
      where: { id: input.id },
      data: {
        name: input.name,
        email: input.email,
        grade: input.grade,
        role: input.role,
        active: input.active,
        ...(input.password
          ? { password: await hashPassword(input.password), awaitingActivation: false }
          : {}),
      },
      select: selection,
    });
    await audit(admin, "user.update", { type: "user", id: user.id }, { role: user.role, active: user.active, passwordReset: Boolean(input.password) }, req);
    return NextResponse.json(user);
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message
        : "Modification impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const admin = await requireAdmin();
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id || id === admin.id) {
      return NextResponse.json(
        { error: "Compte invalide" },
        { status: 400 },
      );
    }
    // ?permanent=1: delete the account for good. Its sessions, weekly courses
    // and the attendance already taken stay (their teacher becomes empty:
    // onDelete SetNull). Administrator accounts are never deleted here.
    if (url.searchParams.get("permanent") === "1") {
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          role: true,
          _count: { select: { taughtSessions: true, weeklySlots: true } },
        },
      });
      if (!user) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
      if (user.role === "ADMIN") {
        return NextResponse.json(
          { error: "Un compte administrateur ne peut pas être supprimé ici : changez d’abord son rôle." },
          { status: 400 },
        );
      }
      await prisma.user.delete({ where: { id } });
      await audit(admin, "user.delete", { type: "user", id }, {
        sessions: user._count.taughtSessions,
        weeklySlots: user._count.weeklySlots,
      }, req);
      return NextResponse.json({ ok: true, deleted: true });
    }
    const result = await prisma.user.updateMany({
      where: { id },
      data: { active: false },
    });
    if (!result.count) {
      return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
    }
    await audit(admin, "user.deactivate", { type: "user", id: id }, undefined, req);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    return NextResponse.json({ error: "Suppression impossible" }, { status: 400 });
  }
}
