import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, requireAdmin, authFailure } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { newPasswordField } from "@/lib/password-policy";
import { audit } from "@/lib/security-log";
import { createAndSendLink, unusablePassword } from "@/lib/account-tokens";

const roleSchema = z.enum(["ADMIN", "DEPARTMENT_HEAD", "PROF"]);
const createSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(200),
  // Empty or absent: the user receives an invitation link and chooses it.
  password: z.union([newPasswordField, z.literal("")]).optional(),
  role: roleSchema,
});
const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(200),
  role: roleSchema,
  active: z.boolean(),
  password: z.union([newPasswordField, z.literal("")]).optional(),
});

const selection = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
  _count: { select: { taughtSessions: true } },
} as const;

// "pending"/"expired": invited but the link was never used (no password chosen yet).
function invitationStatus(tokens: { purpose: string; usedAt: Date | null; expiresAt: Date }[]) {
  const invites = tokens.filter((token) => token.purpose === "INVITE");
  if (!invites.length || invites.some((token) => token.usedAt)) return null;
  return invites.some((token) => token.expiresAt > new Date()) ? "pending" : "expired";
}

export async function GET() {
  try {
    await requireAdmin();
    const users = await prisma.user.findMany({
      select: {
        ...selection,
        accountTokens: { select: { purpose: true, usedAt: true, expiresAt: true } },
      },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });
    return NextResponse.json(
      users.map(({ accountTokens, ...user }) => ({
        ...user,
        invitation: invitationStatus(accountTokens),
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
    const invite = !input.password;
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        password: await hashPassword(input.password || unusablePassword()),
        role: input.role,
      },
      select: selection,
    });
    await audit(admin, "user.create", { type: "user", id: user.id }, { role: user.role, invited: invite }, req);
    if (!invite) return NextResponse.json({ user }, { status: 201 });

    const invitation = await createAndSendLink(req, user, "INVITE", admin.id);
    await audit(admin, "user.invite", { type: "user", id: user.id }, { emailed: invitation.emailed }, req);
    return NextResponse.json({ user, invitation }, { status: 201 });
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
        role: input.role,
        active: input.active,
        ...(input.password
          ? { password: await hashPassword(input.password) }
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
    const id = new URL(req.url).searchParams.get("id");
    if (!id || id === admin.id) {
      return NextResponse.json(
        { error: "Compte invalide" },
        { status: 400 },
      );
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
