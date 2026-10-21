// Shared by the server and the pages (no spreadsheet code here).

// One timetable session lasts 1h30: 21 h of Cours = 14 sessions.
export const SESSION_HOURS = 1.5;

export function sessionsFor(hours: number) {
  return Math.round(hours / SESSION_HOURS);
}

// "Génie Energétique : Tronc commun ( ISSAT Kairouan)" (scolarité file) and
// mention "Génie Energétique" + spécialité "Tronc commun ( ISSAT Kairouan)"
// (parcours list) give the same key.
export function parcoursKey(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]/g, "");
}

export function parcoursLabel(parcours: { mention: string; specialty: string }) {
  return [parcours.mention.trim(), parcours.specialty.trim()].filter(Boolean).join(" : ");
}

// Parcours code written in the scolarité "Parcours" cell: "LI574498",
// "li 574498", "LI574498 - Génie Energétique"… → "LI574498" (null if none).
export function parcoursCodeIn(text: string) {
  const match = text.match(/\b([A-Za-z]{2})\s*(\d{6})\b/);
  return match ? `${match[1]}${match[2]}`.toUpperCase() : null;
}

// "LI661294" → "661294": EE codes start with these digits (661294111).
export function parcoursDigits(code: string) {
  return code.replace(/\D/g, "");
}
