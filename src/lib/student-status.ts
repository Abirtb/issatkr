// Scolarité "Statut" D = dispensé d'assiduité: the student can't be marked
// absent and his absences always count 0 (reports, alerts, absence file).
export const EXEMPT_STATUS = "D";

export function isExempt(status: string | null | undefined) {
  return (status ?? "").trim().toUpperCase() === EXEMPT_STATUS;
}

// Prisma filter: students whose absences count (status stored uppercase;
// "not D" alone would also drop students without status).
export const countedStudent = { OR: [{ status: null }, { status: { not: EXEMPT_STATUS } }] };
