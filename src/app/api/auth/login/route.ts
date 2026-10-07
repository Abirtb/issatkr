import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, verifyLogin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { audit, logServerError } from "@/lib/security-log";
import { clientIp, rateLimit, resetRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(100),
});

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_ACCOUNT = 10;
const MAX_PER_IP = 50;

function tooMany(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Trop de tentatives. Réessayez dans quelques minutes." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}

export async function POST(req: Request) {
  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const ipLimit = rateLimit(`login:ip:${clientIp(req)}`, MAX_PER_IP, WINDOW_MS);
  if (!ipLimit.allowed) return tooMany(ipLimit.retryAfterSeconds);
  const accountKey = `login:account:${body.email}`;
  const accountLimit = rateLimit(accountKey, MAX_PER_ACCOUNT, WINDOW_MS);
  if (!accountLimit.allowed) return tooMany(accountLimit.retryAfterSeconds);

  try {
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    const valid = await verifyLogin(body.password, user?.password);
    if (!user || !user.active || !valid) {
      console.warn("[auth] failed login", { email: body.email, ip: clientIp(req) });
      return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
    }
    resetRateLimit(accountKey);
    await createSession(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      user.password,
      user.sessionVersion,
    );
    await audit({ id: user.id, role: user.role }, "auth.login", { type: "user", id: user.id }, undefined, req);
    return NextResponse.json({ role: user.role, name: user.name });
  } catch (error) {
    logServerError("auth.login", error);
    return NextResponse.json({ error: "Connexion impossible" }, { status: 500 });
  }
}
