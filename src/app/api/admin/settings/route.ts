import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { getAbsenceLimit, setAbsenceLimit } from "@/lib/settings";
import { audit } from "@/lib/security-log";

export async function GET() {
  try {
    await requireAdmin();
    const absenceLimit = await getAbsenceLimit();
    return NextResponse.json({ absenceLimit });
  } catch {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
}

export async function PUT(req: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const parsed = z
    .object({ absenceLimit: z.coerce.number().int().min(1).max(100) })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Seuil invalide" }, { status: 400 });
  }
  await setAbsenceLimit(parsed.data.absenceLimit);
  await audit(admin, "settings.update", { type: "setting", id: "absence_limit" }, { value: parsed.data.absenceLimit }, req);
  return NextResponse.json({ absenceLimit: parsed.data.absenceLimit });
}
