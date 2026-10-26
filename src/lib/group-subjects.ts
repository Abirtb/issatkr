import { classParts } from "./class-name";

// Subjects of a group (class): the EE of its parcours for its level (year of
// study: S1-S2 → 1, S3-S4 → 2…) and its programme (level + spécialité).
// Shared by the pages that narrow a subject list to a group.

export type GroupInfo = {
  name: string;
  levelId: string | null;
  parcoursId: string | null;
  semester: number | null;
  level?: { code: string } | null;
};
export type SubjectLinks = {
  elements: { parcoursId: string; semester: number }[];
  curricula: { levelId: string; specialty: string }[];
};

export function groupYear(group: GroupInfo) {
  if (group.semester) return Math.ceil(group.semester / 2);
  const fromLevel = Number(group.level?.code.match(/(\d+)\s*$/)?.[1] ?? NaN);
  return Number.isFinite(fromLevel) ? fromLevel : (classParts(group.name).year ?? NaN);
}

// Semester of the subject in the group's parcours, for its level (undefined: not an EE of the group).
export function semesterInGroup(subject: SubjectLinks, group: GroupInfo) {
  const year = groupYear(group);
  return subject.elements.find(
    (element) =>
      element.parcoursId === group.parcoursId &&
      (!Number.isFinite(year) || Math.ceil(element.semester / 2) === year),
  )?.semester;
}

export function isGroupSubject(subject: SubjectLinks, group: GroupInfo) {
  const specialty = classParts(group.name).specialty ?? "";
  return (
    (Boolean(group.parcoursId) && semesterInGroup(subject, group) !== undefined) ||
    (Boolean(group.levelId) &&
      subject.curricula.some(
        (entry) => entry.levelId === group.levelId && (entry.specialty === "" || entry.specialty === specialty),
      ))
  );
}
