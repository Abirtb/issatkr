// Teachers may only take attendance during the first 90 minutes of a session.
export const ATTENDANCE_WINDOW_MINUTES = 90;

const DEFAULT_TIME_ZONE = process.env.ATTENDANCE_TIME_ZONE ?? "Africa/Tunis";

export type AttendanceWindow = {
  opensAt: Date;
  closesAt: Date;
  state: "upcoming" | "open" | "closed";
};

function zonedParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

export function parseStartTime(value: string) {
  const match = value.trim().match(/^(\d{1,2})\s*[:hH.]\s*(\d{2})?/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

// Session dates are stored as a calendar day (around midday); the start time is
// wall-clock time in the school's time zone.
export function sessionStartsAt(
  date: Date,
  startTime: string,
  timeZone = DEFAULT_TIME_ZONE,
) {
  const time = parseStartTime(startTime);
  if (!time) return null;
  const { year, month, day } = zonedParts(date, timeZone);
  const wallAsUtc = Date.UTC(year, month - 1, day, time.hour, time.minute);
  const p = zonedParts(new Date(wallAsUtc), timeZone);
  const offset =
    Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) -
    wallAsUtc;
  return new Date(wallAsUtc - offset);
}

export function getAttendanceWindow(
  date: Date,
  startTime: string,
  now = new Date(),
  timeZone = DEFAULT_TIME_ZONE,
): AttendanceWindow | null {
  const opensAt = sessionStartsAt(date, startTime, timeZone);
  if (!opensAt) return null;
  const closesAt = new Date(
    opensAt.getTime() + ATTENDANCE_WINDOW_MINUTES * 60_000,
  );
  const state =
    now < opensAt ? "upcoming" : now > closesAt ? "closed" : "open";
  return { opensAt, closesAt, state };
}
