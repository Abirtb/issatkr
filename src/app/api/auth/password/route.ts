import { NextResponse } from "next/server";
import { z } from "zod";
import {
  authFailure,
  createSession,
  hashPassword,
  requireSession,
  verifyPassword,
} from "@/lib/auth";
import { prisma } from "@/lib/db";
import { newPasswordField } from "@/lib/password-policy";
import { rateLimit } from "@/lib/rate-limit";
import { audit, logServerError } from "@/lib/security-log";

const schema = z.object({
  currentPassword: z.string().min(1).max(100),
  newPassword: newPasswordField,
});

// Self-service password change for every role. The current password is
// required, so a borrowed or stolen session cannot lock the owner out.
export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const limit = rateLimit(`password-change:${session.id}`, 5, 15 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Trop de tentatives. Réessayez plus tard." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
      );
    }
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Données invalides" },
        { status: 400 },
      );
    }
    const { currentPassword, newPassword } = parsed.data;
    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user || !(await verifyPassword(currentPassword, user.password))) {
      return NextResponse.json({ error: "Mot de passe actuel incorrect" }, { status: 400 });
    }
    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: "Le nouveau mot de passe doit être différent" },
        { status: 400 },
      );
    }
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { password: await hashPassword(newPassword) },
    });
    // The new hash invalidates every other session; keep this device signed in.
    await createSession(session, updated.password, updated.sessionVersion);
    await audit(session, "auth.password_change", { type: "user", id: user.id }, undefined, req);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    logServerError("auth.password", error);
    return NextResponse.json({ error: "Modification impossible" }, { status: 500 });
  }
}
