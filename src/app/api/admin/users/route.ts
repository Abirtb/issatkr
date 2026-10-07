import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, requireAdmin, authFailure } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { newPasswordField } from "@/lib/password-policy";
import { audit } from "@/lib/security-log";

const roleSchema = z.enum(["ADMIN", "DEPARTMENT_HEAD", "PROF"]);
const createSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(200),
  password: newPasswordField,
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

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(
      await prisma.user.findMany({
        select: selection,
        orderBy: [{ active: "desc" }, { name: "asc" }],
      }),
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
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        password: await hashPassword(input.password),
        role: input.role,
      },
      select: selection,
    });
    await audit(admin, "user.create", { type: "user", id: user.id }, { role: user.role }, req);
    return NextResponse.json(user, { status: 201 });
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
