import { NextResponse } from "next/server";
import { z } from "zod";
import { authFailure, requireAdmin } from "@/lib/auth";
import { createAndSendLink, linkPurposeFor } from "@/lib/account-tokens";
import { prisma } from "@/lib/db";
import { throttleUser } from "@/lib/rate-limit";
import { audit, logServerError } from "@/lib/security-log";

const MAX_BATCH = 200;
const id = z.string().min(1).max(64);
// One account ({ id }) or several at once ({ ids }) for "send all invitations".
const schema = z.union([
  z.object({ id }),
  z.object({ ids: z.array(id).min(1).max(MAX_BATCH) }),
]);

// Sends (or re-sends) a one-time link: an invitation for an account never
// activated, otherwise a password reset. Any earlier pending link stops working.
// Nothing is ever sent automatically: only this route, on an admin's click.
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const throttled = throttleUser(admin.id, "import");
    if (throttled) return throttled;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Compte invalide" }, { status: 400 });
    }
    const ids = "id" in parsed.data ? [parsed.data.id] : [...new Set(parsed.data.ids)];
    const users = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, email: true, active: true },
    });

    if ("id" in parsed.data) {
      const [user] = users;
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
    }

    // Batch: one result per account; inactive accounts are skipped.
    const results = [];
    for (const user of users.filter((item) => item.active)) {
      const purpose = await linkPurposeFor(user.id);
      const link = await createAndSendLink(req, user, purpose, admin.id);
      results.push({ id: user.id, name: user.name, email: user.email, purpose, ...link });
    }
    await audit(admin, "user.invite_batch", { type: "user", id: null }, {
      requested: ids.length,
      sent: results.length,
      emailed: results.filter((result) => result.emailed).length,
    }, req);
    return NextResponse.json({ results, skipped: ids.length - results.length });
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    logServerError("users.invite", error);
    return NextResponse.json({ error: "Envoi impossible" }, { status: 500 });
  }
}
