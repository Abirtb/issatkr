import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

// Weekly courses ("every Monday 08:30") are turned into real Session rows so
// attendance works the same for them as for one-off sessions. Dates are handled
// as local "YYYY-MM-DD" keys and stored at local noon, like the rest of the
// schedule (see scheduleDate).

type Tx = Prisma.TransactionClient;

export function scheduleDate(key: string) {
  const date = new Date(`${key}T12:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error("INVALID_DATE");
  return date;
}

export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// 1 = Monday … 7 = Sunday.
export function isoWeekday(key: string) {
  return scheduleDate(key).getDay() || 7;
}

export function addDays(key: string, days: number) {
  const date = scheduleDate(key);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

export function parseExcluded(value: string) {
  return new Set(value.split(",").map((item) => item.trim()).filter(Boolean));
}

export type DayOffRange = { startDate: string; endDate: string };

export function isDayOff(key: string, daysOff: DayOffRange[]) {
  return daysOff.some((range) => key >= range.startDate && key <= range.endDate);
}

// Every date of the period falling on `weekday`, from `from` on, minus days off
// and dates removed by hand. Every other week (interval 2): weeks are counted
// from the period start, so week A / week B never shift (not even around a
// holiday); offset 1 starts on the 2nd week.
export function occurrenceDates(
  period: { startDate: string; endDate: string },
  weekday: number,
  daysOff: DayOffRange[],
  excluded: Set<string>,
  from: string,
  intervalWeeks = 1,
  weekOffset = 0,
) {
  const dates: string[] = [];
  let day = period.startDate;
  while (isoWeekday(day) !== weekday) day = addDays(day, 1);
  day = addDays(day, 7 * (weekOffset % intervalWeeks));
  for (; day <= period.endDate; day = addDays(day, 7 * intervalWeeks)) {
    if (day >= from && !isDayOff(day, daysOff) && !excluded.has(day)) dates.push(day);
  }
  return dates;
}

export type SyncResult = { created: number; updated: number; removed: number; conflicts: number };
const emptyResult = (): SyncResult => ({ created: 0, updated: 0, removed: 0, conflicts: 0 });

function addResult(total: SyncResult, part: SyncResult) {
  total.created += part.created;
  total.updated += part.updated;
  total.removed += part.removed;
  total.conflicts += part.conflicts;
  return total;
}

async function loadDaysOff(tx: Tx): Promise<DayOffRange[]> {
  const rows = await tx.dayOff.findMany({ select: { startDate: true, endDate: true } });
  return rows.map((row) => ({ startDate: dateKey(row.startDate), endDate: dateKey(row.endDate) }));
}

// Brings the future sessions of one weekly course in line with it. Only
// sessions from today on, never marked (no roll call, no attendance) are
// created, changed or removed: the past and anything already used stay as is.
export async function syncWeeklySlot(
  tx: Tx,
  slotId: string,
  daysOff?: DayOffRange[],
  today = dateKey(new Date()),
): Promise<SyncResult> {
  const result = emptyResult();
  const slot = await tx.weeklySlot.findUnique({
    where: { id: slotId },
    include: { period: true, subject: true },
  });
  if (!slot) return result;
  const targets = new Set(
    occurrenceDates(
      { startDate: dateKey(slot.period.startDate), endDate: dateKey(slot.period.endDate) },
      slot.weekday,
      daysOff ?? (await loadDaysOff(tx)),
      parseExcluded(slot.excludedDates),
      today,
      slot.intervalWeeks,
      slot.weekOffset,
    ),
  );

  const existing = await tx.session.findMany({
    where: { weeklySlotId: slot.id, date: { gte: scheduleDate(today) } },
    select: {
      id: true,
      date: true,
      finalizedAt: true,
      classId: true,
      subjectId: true,
      professorId: true,
      courseName: true,
      courseCode: true,
      startTime: true,
      endTime: true,
      room: true,
      _count: { select: { attendances: true } },
    },
  });
  const fields = {
    classId: slot.classId,
    subjectId: slot.subjectId,
    professorId: slot.professorId,
    courseName: slot.subject.name,
    courseCode: slot.subject.code,
    startTime: slot.startTime,
    endTime: slot.endTime,
    room: slot.room,
  };
  const covered = new Set<string>();
  for (const session of existing) {
    const key = dateKey(session.date);
    const untouched = !session.finalizedAt && session._count.attendances === 0;
    if (!untouched) {
      covered.add(key);
      continue;
    }
    if (!targets.has(key) || covered.has(key)) {
      await tx.session.delete({ where: { id: session.id } });
      result.removed++;
      continue;
    }
    covered.add(key);
    // Already matching the course: nothing to write.
    if ((Object.keys(fields) as (keyof typeof fields)[]).every((field) => session[field] === fields[field])) {
      continue;
    }
    const clash = await tx.session.findFirst({
      where: {
        id: { not: session.id },
        classId: fields.classId,
        courseName: fields.courseName,
        date: session.date,
        startTime: fields.startTime,
      },
      select: { id: true },
    });
    if (clash) {
      result.conflicts++;
      continue;
    }
    await tx.session.update({ where: { id: session.id }, data: fields });
    result.updated++;
  }

  for (const key of targets) {
    if (covered.has(key)) continue;
    const date = scheduleDate(key);
    // Same class, course and start already planned (e.g. a one-off session).
    const clash = await tx.session.findFirst({
      where: { classId: fields.classId, courseName: fields.courseName, date, startTime: fields.startTime },
      select: { id: true },
    });
    if (clash) {
      result.conflicts++;
      continue;
    }
    await tx.session.create({ data: { ...fields, date, weeklySlotId: slot.id } });
    result.created++;
  }
  return result;
}

// After a change to the days off or to a period: re-sync the courses concerned.
export async function syncWeeklySlots(tx: Tx, where: Prisma.WeeklySlotWhereInput = {}) {
  const daysOff = await loadDaysOff(tx);
  const slots = await tx.weeklySlot.findMany({ where, select: { id: true } });
  const total = emptyResult();
  for (const slot of slots) addResult(total, await syncWeeklySlot(tx, slot.id, daysOff));
  return total;
}

// Removes the future, never-marked sessions of a course (before deleting it).
export async function removeFutureSessions(tx: Tx, where: Prisma.SessionWhereInput) {
  const removed = await tx.session.deleteMany({
    where: {
      ...where,
      date: { gte: scheduleDate(dateKey(new Date())) },
      finalizedAt: null,
      attendances: { none: {} },
    },
  });
  return removed.count;
}

export async function inTransaction<T>(run: (tx: Tx) => Promise<T>) {
  return prisma.$transaction(run, { timeout: 60_000 });
}

export function describeSync(result: SyncResult) {
  const parts = [
    result.created ? `${result.created} séance(s) créée(s)` : "",
    result.updated ? `${result.updated} mise(s) à jour` : "",
    result.removed ? `${result.removed} retirée(s)` : "",
    result.conflicts ? `${result.conflicts} déjà prévue(s) à ce créneau (ignorée(s))` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Aucune séance à modifier";
}
