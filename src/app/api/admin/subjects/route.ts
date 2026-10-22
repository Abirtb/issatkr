import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, authFailure } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/security-log";

const schema = z.object({
  id: z.string().min(1).optional(),
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(2).max(150),
  active: z.boolean().optional(),
});

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(
      await prisma.subject.findMany({
        include: {
          _count: { select: { sessions: true } },
          curricula: {
            select: { id: true, specialty: true, level: { select: { code: true } } },
          },
        },
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
    await requireAdmin();
    const input = schema.parse(await req.json());
    return NextResponse.json(
      await prisma.subject.create({
        data: { code: input.code.toUpperCase(), name: input.name },
      }),
      { status: 201 },
    );
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    return NextResponse.json(
      { error: "Code déjà utilisé ou données invalides" },
      { status: 400 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdmin();
    const input = schema.parse(await req.json());
    if (!input.id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }
    return NextResponse.json(
      await prisma.subject.update({
        where: { id: input.id },
        data: {
          code: input.code.toUpperCase(),
          name: input.name,
          active: input.active ?? true,
        },
      }),
    );
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    return NextResponse.json({ error: "Modification impossible" }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const admin = await requireAdmin();
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });
    // ?permanent=1: delete for good, only if nothing was ever planned or
    // recorded with it. Otherwise: deactivate (hidden from new choices).
    if (url.searchParams.get("permanent") === "1") {
      const used = await prisma.subject.findUnique({
        where: { id },
        select: {
          _count: {
            select: { sessions: true, weeklySlots: true, alertStates: true, notifications: true },
          },
        },
      });
      if (!used) return NextResponse.json({ error: "Matière introuvable" }, { status: 404 });
      const { sessions, weeklySlots, alertStates, notifications } = used._count;
      if (sessions || weeklySlots || alertStates || notifications) {
        return NextResponse.json(
          {
            error: `Suppression impossible : matière utilisée (${sessions} séance(s), ${weeklySlots} cours hebdomadaire(s)). Désactivez-la plutôt.`,
          },
          { status: 409 },
        );
      }
      await prisma.subject.delete({ where: { id } });
      await audit(admin, "subject.delete", { type: "subject", id }, undefined, req);
      return NextResponse.json({ ok: true, deleted: true });
    }
    await prisma.subject.update({ where: { id }, data: { active: false } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    return NextResponse.json({ error: "Désactivation impossible" }, { status: 400 });
  }
}
