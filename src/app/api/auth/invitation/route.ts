import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, hashPassword } from "@/lib/auth";
import { findUsableToken } from "@/lib/account-tokens";
import { prisma } from "@/lib/db";
import { newPasswordField } from "@/lib/password-policy";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { audit, logServerError } from "@/lib/security-log";

const schema = z.object({ token: z.string().max(100), password: newPasswordField });

// Uses a one-time link: sets the password chosen by the person, burns the link,
// signs out every other session of the account, and signs this browser in.
export async function POST(req: Request) {
  const limit = rateLimit(`invite-accept:${clientIp(req)}`, 10, 15 * 60 * 1000);
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
  try {
    const record = await findUsableToken(parsed.data.token);
    if (!record) {
      return NextResponse.json(
        { error: "Ce lien n’est plus valable. Demandez un nouveau lien à l’administration." },
        { status: 410 },
      );
    }
    const now = new Date();
    const passwordHash = await hashPassword(parsed.data.password);
    // usedAt: null in the condition makes the link single-use even under a race.
    const burned = await prisma.accountToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: now },
    });
    if (burned.count !== 1) {
      return NextResponse.json(
        { error: "Ce lien a déjà été utilisé." },
        { status: 410 },
      );
    }
    const [user] = await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { password: passwordHash, awaitingActivation: false, sessionVersion: { increment: 1 } },
      }),
      prisma.accountToken.updateMany({
        where: { userId: record.userId, usedAt: null, expiresAt: { gt: now } },
        data: { expiresAt: now },
      }),
    ]);
    await createSession(
      { id: user.id, email: user.email ?? "", name: user.name, role: user.role },
      user.password,
      user.sessionVersion,
    );
    await audit(user, "auth.invitation_accept", { type: "user", id: user.id }, { purpose: record.purpose }, req);
    return NextResponse.json({ role: user.role });
  } catch (error) {
    logServerError("auth.invitation", error);
    return NextResponse.json({ error: "Activation impossible" }, { status: 500 });
  }
}
