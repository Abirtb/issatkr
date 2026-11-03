import { classParts } from "./class-name";
import { levelFamily, yearOfSemester } from "./parse-upload";

// Programmes deduced from the parcours files, so the "Programme par niveau et
// spécialité" section is pre-filled:
// - level: the EE's semester (S1-S2 → 1, S3-S4 → 2…), same family only
//   (LI… parcours → Licence);
// - spécialité: "" (tronc commun) for a "Tronc commun" parcours, and the
//   spécialité of the classes linked to the parcours (1ENR-1 → ENR).

type Level = { id: string; code: string };
type ParcoursData = {
  code: string;
  mention: string;
  specialty: string;
  classes: { name: string }[];
  elements: { subjectId: string; semester: number }[];
};
export type AutoEntry = { subjectId: string; levelId: string; specialty: string; parcoursCode: string };

function familyOfLevel(code: string) {
  return code.replace(/\d+\s*$/, "").toUpperCase();
}

function familyOfParcours(parcours: ParcoursData) {
  if (/^LI/i.test(parcours.code)) return "L";
  if (/^M/i.test(parcours.code)) return "M";
  return levelFamily(`${parcours.mention} ${parcours.specialty}`).prefix;
}

export function autoProgrammes(levels: Level[], parcoursList: ParcoursData[]): AutoEntry[] {
  const entries = new Map<string, AutoEntry>();
  for (const level of levels) {
    const year = Number(level.code.match(/(\d+)\s*$/)?.[1] ?? NaN);
    if (!Number.isFinite(year)) continue;
    const family = familyOfLevel(level.code);
    for (const parcours of parcoursList) {
      if (familyOfParcours(parcours) !== family) continue;
      const specialties = new Set(
        parcours.classes.map((cls) => classParts(cls.name).specialty).filter((value): value is string => Boolean(value)),
      );
      if (/tronc\s*commun/i.test(parcours.specialty)) specialties.add("");
      for (const element of parcours.elements) {
        if (yearOfSemester(element.semester) !== year) continue;
        for (const specialty of specialties) {
          const key = `${element.subjectId}:${level.id}:${specialty}`;
          if (!entries.has(key)) {
            entries.set(key, { subjectId: element.subjectId, levelId: level.id, specialty, parcoursCode: parcours.code });
          }
        }
      }
    }
  }
  return [...entries.values()];
}
