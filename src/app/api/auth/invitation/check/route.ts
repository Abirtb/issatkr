import { NextResponse } from "next/server";
import { findUsableToken } from "@/lib/account-tokens";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// Lets the activation page greet the person before they choose a password.
// Says only "valid" or "not valid": no detail on why a link is refused.
export async function POST(req: Request) {
  const limit = rateLimit(`invite-check:${clientIp(req)}`, 30, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ valid: false }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  const record = await findUsableToken(body?.token);
  if (!record) return NextResponse.json({ valid: false }, { status: 410 });
  return NextResponse.json({
    valid: true,
    purpose: record.purpose,
    name: record.user.name,
    email: record.user.email,
    expiresAt: record.expiresAt,
  });
}
