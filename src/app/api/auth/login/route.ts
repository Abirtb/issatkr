import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(100),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (
      !user ||
      !user.active ||
      !(await verifyPassword(body.password, user.password))
    ) {
      return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
    }
    await createSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
    return NextResponse.json({ role: user.role, name: user.name });
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
}
