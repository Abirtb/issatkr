import { NextResponse } from "next/server";
import { sendPendingNotifications } from "@/lib/mail";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (
    !secret ||
    req.headers.get("authorization") !== `Bearer ${secret}`
  ) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  return NextResponse.json(await sendPendingNotifications(25));
}
