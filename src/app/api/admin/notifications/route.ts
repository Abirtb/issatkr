import { NextResponse } from "next/server";
import { requireAdmin, authFailure } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendNotification } from "@/lib/mail";

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const status = new URL(req.url).searchParams.get("status");
    const notifications = await prisma.notificationLog.findMany({
      where:
        status && ["PENDING", "SENDING", "SENT", "FAILED"].includes(status)
          ? { status: status as "PENDING" | "SENDING" | "SENT" | "FAILED" }
          : undefined,
      include: {
        // Listing view: identity only, no CIN/phone/Arabic names.
        student: { select: { id: true, firstName: true, lastName: true, matricule: true, class: { select: { name: true } } } },
        subject: { select: { name: true } },
        level: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json(notifications);
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const { id } = (await req.json()) as { id?: string };
    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });
    await prisma.notificationLog.updateMany({
      where: { id, status: "FAILED" },
      data: { status: "PENDING", attempts: 0, error: null },
    });
    const sent = await sendNotification(id);
    return NextResponse.json({ ok: sent });
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    return NextResponse.json({ error: "Relance impossible" }, { status: 400 });
  }
}
