import { NextResponse } from "next/server";
import { destroySession, getSession } from "@/lib/auth";
import { audit } from "@/lib/security-log";

export async function POST(req: Request) {
  const session = await getSession();
  await destroySession(session?.id);
  if (session) await audit(session, "auth.logout", { type: "user", id: session.id }, undefined, req);
  return NextResponse.json({ ok: true });
}
