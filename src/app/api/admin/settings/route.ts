import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAbsenceLimit, setAbsenceLimit } from "@/lib/settings";

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
  try {
    await requireAdmin();
    const { absenceLimit } = await req.json();
    const n = Number(absenceLimit);
    if (!Number.isFinite(n) || n < 1) {
      return NextResponse.json({ error: "Seuil invalide" }, { status: 400 });
    }
    await setAbsenceLimit(n);
    return NextResponse.json({ absenceLimit: n });
  } catch {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
}
