import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Liveness + database reachability for Docker, Nginx and monitoring.
// Deliberately says nothing about versions, configuration or data.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}
