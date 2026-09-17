import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";

const professorSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(100),
});

export async function GET() {
  try {
    await requireAdmin();
    const professors = await prisma.user.findMany({
      where: { role: "PROF" },
      select: {
        id: true,
        name: true,
        email: true,
        _count: { select: { taughtSessions: true } },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(professors);
  } catch {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const input = professorSchema.parse(await req.json());
    const professor = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        password: await hashPassword(input.password),
        role: "PROF",
      },
      select: { id: true, name: true, email: true },
    });
    return NextResponse.json(professor, { status: 201 });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message
        : "E-mail déjà utilisé ou données invalides";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
