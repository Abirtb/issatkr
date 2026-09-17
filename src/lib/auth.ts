import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
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

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const user = await prisma.user.findUnique({
      where: { id: payload.id as string },
      select: { id: true, email: true, name: true, role: true, active: true },
    });
    if (!user?.active) return null;
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
