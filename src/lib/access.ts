import type { SessionUser } from "./auth";
import { prisma } from "./db";

export function classScope(user: SessionUser) {
  return user.role === "ADMIN"
    ? {}
    : { sessions: { some: { professorId: user.id } } };
}

export async function canAccessClass(user: SessionUser, classId: string) {
  if (user.role === "ADMIN") return true;
  const count = await prisma.class.count({
    where: {
      id: classId,
      sessions: { some: { professorId: user.id } },
    },
  });
  return count > 0;
}

export async function canAccessSession(user: SessionUser, sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { professorId: true },
  });
  if (!session) return { exists: false, allowed: false };
  return {
    exists: true,
    allowed: user.role === "ADMIN" || session.professorId === user.id,
  };
}
