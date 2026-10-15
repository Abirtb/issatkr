import { NextResponse } from "next/server";
import { z } from "zod";
import { authFailure, requireAdmin } from "@/lib/auth";
import { createAndSendLink, linkPurposeFor } from "@/lib/account-tokens";
import { prisma } from "@/lib/db";
import { throttleUser } from "@/lib/rate-limit";
import { audit, logServerError } from "@/lib/security-log";

const schema = z.object({ id: z.string().min(1).max(64) });

// Sends (or re-sends) a one-time link: an invitation for an account never
// activated, otherwise a password reset. Any earlier pending link stops working.
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const throttled = throttleUser(admin.id, "import");
    if (throttled) return throttled;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Compte invalide" }, { status: 400 });
    }
    const user = await prisma.user.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, name: true, email: true, active: true },
    });
    if (!user) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
    if (!user.active) {
      return NextResponse.json({ error: "Réactivez d’abord ce compte" }, { status: 400 });
    }
    const purpose = await linkPurposeFor(user.id);
    const link = await createAndSendLink(req, user, purpose, admin.id);
    await audit(
      admin,
      purpose === "INVITE" ? "user.invite" : "user.password_link",
      { type: "user", id: user.id },
      { emailed: link.emailed },
      req,
    );
    return NextResponse.json({ purpose, ...link });
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    logServerError("users.invite", error);
    return NextResponse.json({ error: "Envoi impossible" }, { status: 500 });
  }
}
