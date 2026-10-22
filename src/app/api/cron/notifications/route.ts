import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sendPendingNotifications } from "@/lib/mail";

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

// Constant-time check of the bearer token (hashing equalises the lengths).
function authorized(header: string | null) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16 || !header) return false;
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}

export async function POST(req: Request) {
  if (!authorized(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  return NextResponse.json(await sendPendingNotifications(25));
}
