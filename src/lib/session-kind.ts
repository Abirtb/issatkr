// Nature of a session: Cours, TD or TP. The choices come from the hours of the
// EE (élément d'enseignement) in the class's parcours: an EE with 0 h of TP
// offers no TP session.

export const SESSION_KINDS = ["COURS", "TD", "TP"] as const;
export type SessionKind = (typeof SESSION_KINDS)[number];

const LABELS: Record<SessionKind, string> = { COURS: "Cours", TD: "TD", TP: "TP" };

export function kindLabel(kind: string | null | undefined) {
  return kind && kind in LABELS ? LABELS[kind as SessionKind] : "";
}

// "Cours", "C", "TD", "Travaux dirigés", "tp"… → COURS / TD / TP; "" if unknown.
export function parseKind(value: string | null | undefined): SessionKind | "" {
  const key = String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z]/g, "");
  if (["cours", "c", "cm", "coursmagistral"].includes(key)) return "COURS";
  if (key === "td" || key.startsWith("travauxdiriges")) return "TD";
  if (key === "tp" || key.startsWith("travauxpratiques")) return "TP";
  return "";
}

export type ElementHours = {
  parcoursId: string;
  hoursLecture: number;
  hoursTutorial: number;
  hoursLab: number;
};

export function kindHours(element: ElementHours, kind: SessionKind) {
  return kind === "COURS" ? element.hoursLecture : kind === "TD" ? element.hoursTutorial : element.hoursLab;
}

// The EE of the class's parcours if there is one, else any EE of the subject.
export function elementsFor(elements: ElementHours[], parcoursId?: string | null) {
  const own = parcoursId ? elements.filter((element) => element.parcoursId === parcoursId) : [];
  return own.length ? own : elements;
}

// Kinds planned for this subject; all three when no EE gives hours.
export function allowedKinds(elements: ElementHours[], parcoursId?: string | null): SessionKind[] {
  const source = elementsFor(elements, parcoursId);
  const kinds = SESSION_KINDS.filter((kind) => source.some((element) => kindHours(element, kind) > 0));
  return kinds.length ? kinds : [...SESSION_KINDS];
}
