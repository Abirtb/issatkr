import { createHmac, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { prisma } from "./db";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

const COOKIE = "issatkr_session";

function secret() {
  const s = process.env.AUTH_SECRET;
  if (
    !s ||
    (process.env.NODE_ENV === "production" &&
      (s.length < 32 || s.includes("generate-with")))
  ) {
    throw new Error("AUTH_SECRET must be a random value of at least 32 characters");
  }
  return new TextEncoder().encode(s);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

// Compared against for unknown e-mails so a login takes the same time either way.
const DUMMY_HASH = bcrypt.hashSync("timing-equalizer-not-a-password", 12);

export async function verifyLogin(
  password: string,
  hash: string | undefined,
) {
  const ok = await bcrypt.compare(password, hash ?? DUMMY_HASH);
  return Boolean(hash) && ok;
}

// Ties a session to the password it was opened with: changing the password
// (or resetting it from the admin page) invalidates every older session.
export function passwordFingerprint(passwordHash: string) {
  return createHmac("sha256", secret())
    .update(passwordHash)
    .digest("hex")
    .slice(0, 32);
}

function sameFingerprint(a: unknown, b: string) {
  if (typeof a !== "string" || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// One school day: a session left open on a shared computer does not last for days.
const SESSION_SECONDS = 12 * 60 * 60;

export async function createSession(
  user: SessionUser,
  passwordHash: string,
  sessionVersion: number,
) {
  const token = await new SignJWT({
    id: user.id,
    pv: passwordFingerprint(passwordHash),
    sv: sessionVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

// Logout revokes server-side: bumping sessionVersion rejects every token issued
// before, so a copied cookie stops working too (on all of the user's devices).
export async function destroySession(userId?: string) {
  if (userId) {
    await prisma.user.updateMany({
      where: { id: userId },
      data: { sessionVersion: { increment: 1 } },
    });
  }
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), {
      algorithms: ["HS256"],
    });
    if (typeof payload.id !== "string") return null;
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        password: true,
        sessionVersion: true,
      },
    });
    if (!user?.active) return null;
    if (payload.sv !== user.sessionVersion) return null;
    if (!sameFingerprint(payload.pv, passwordFingerprint(user.password))) {
      return null;
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  } catch {
    return null;
  }
}

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (!isAdminRole(session.role)) throw new Error("FORBIDDEN");
  return session;
}

// Keeps authentication/authorization failures as 401/403 in route catch blocks
// instead of letting them collapse into generic 400/500 errors.
export function authFailure(error: unknown) {
  if (!(error instanceof Error)) return null;
  if (error.message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (error.message === "FORBIDDEN") {
    return NextResponse.json({ error: "Accès interdit" }, { status: 403 });
  }
  return null;
}

export function isAdminRole(role: Role) {
  return role === "ADMIN";
}

export function isScheduleManagerRole(role: Role) {
  return role === "ADMIN" || role === "DEPARTMENT_HEAD";
}

export async function requireScheduleManager() {
  const session = await requireSession();
  if (!isScheduleManagerRole(session.role)) {
    throw new Error("FORBIDDEN");
  }
  return session;
}
