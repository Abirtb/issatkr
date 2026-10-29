import * as XLSX from "xlsx";
import { prisma } from "./db";
import { getAttendanceWindow } from "./attendance-window";
import { createMailTransport, escapeHtml } from "./mail";
import { logServerError } from "./security-log";

// A teacher is counted absent for a planned session whose roll call was never
// taken: the session is over and nothing was saved for it.
export type TeacherAbsence = {
  sessionId: string;
  date: Date;
  startTime: string;
  endTime: string | null;
  courseName: string;
  courseCode: string | null;
  room: string | null;
  className: string;
  professorId: string | null;
  professorName: string | null;
};

export async function findTeacherAbsences(input: { from?: Date; to?: Date; professorId?: string; now?: Date }) {
  const now = input.now ?? new Date();
  const sessions = await prisma.session.findMany({
    where: {
      finalizedAt: null,
      attendances: { none: {} },
      date: { gte: input.from, lte: input.to && input.to < now ? input.to : now },
      ...(input.professorId ? { professorId: input.professorId } : {}),
    },
    select: {
      id: true,
      date: true,
      startTime: true,
      endTime: true,
      courseName: true,
      courseCode: true,
      room: true,
      class: { select: { name: true } },
      professor: { select: { id: true, name: true } },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    take: 5000,
  });
  return sessions
    .filter((session) => getAttendanceWindow(session.date, session.startTime, session.endTime, now)?.state === "closed")
    .map(
      (session): TeacherAbsence => ({
        sessionId: session.id,
        date: session.date,
        startTime: session.startTime,
        endTime: session.endTime,
        courseName: session.courseName,
        courseCode: session.courseCode,
        room: session.room,
        className: session.class.name,
        professorId: session.professor?.id ?? null,
        professorName: session.professor?.name ?? null,
      }),
    );
}

const TIME_ZONE = process.env.ATTENDANCE_TIME_ZONE ?? "Africa/Tunis";
const dayLabel = (date: Date) => new Intl.DateTimeFormat("fr-FR", { timeZone: TIME_ZONE }).format(date);
const teacherLabel = (row: TeacherAbsence) => row.professorName ?? "Enseignant non affecté";
const hours = (row: TeacherAbsence) => (row.endTime ? `${row.startTime}–${row.endTime}` : row.startTime);

export const TEACHER_ABSENCE_HEADER = ["Enseignant", "Date", "Horaire", "Matière", "Code", "Groupe", "Salle"] as const;

export function teacherAbsenceWorkbook(rows: TeacherAbsence[]) {
  const sorted = [...rows].sort(
    (a, b) => teacherLabel(a).localeCompare(teacherLabel(b), "fr") || a.date.getTime() - b.date.getTime(),
  );
  const detail = XLSX.utils.aoa_to_sheet([
    [...TEACHER_ABSENCE_HEADER],
    ...sorted.map((row) => [
      teacherLabel(row),
      dayLabel(row.date),
      hours(row),
      row.courseName,
      row.courseCode ?? "",
      row.className,
      row.room ?? "",
    ]),
  ]);
  detail["!cols"] = [28, 12, 14, 34, 14, 16, 10].map((wch) => ({ wch }));
  const counts = new Map<string, number>();
  for (const row of sorted) counts.set(teacherLabel(row), (counts.get(teacherLabel(row)) ?? 0) + 1);
  const summary = XLSX.utils.aoa_to_sheet([["Enseignant", "Séances sans appel"], ...counts]);
  summary["!cols"] = [{ wch: 28 }, { wch: 18 }];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, summary, "Par enseignant");
  XLSX.utils.book_append_sheet(book, detail, "Détail");
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function zonedToday(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return { day: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

export const DIGEST_HOUR = Number(process.env.TEACHER_ABSENCE_DIGEST_HOUR ?? 18);
const DIGEST_KEY = "teacher_absence_digest";

// Once a day (from DIGEST_HOUR, school time), e-mails the administrators the
// sessions of the day whose roll call was not taken, with the Excel file.
// Called by the cron every 15 minutes; the date sent is kept in Setting.
export async function sendTeacherAbsenceDigest(now = new Date()) {
  const today = zonedToday(now);
  if (today.hour < DIGEST_HOUR) return { sent: false, reason: "too-early" };
  const last = await prisma.setting.findUnique({ where: { key: DIGEST_KEY } });
  if (last?.value === today.day) return { sent: false, reason: "already-sent" };
  // Session dates are a calendar day around midday: take a wide range, then
  // keep the sessions of the local day.
  const day = new Date(`${today.day}T12:00:00Z`).getTime();
  const rows = (
    await findTeacherAbsences({ from: new Date(day - 86_400_000), to: new Date(day + 86_400_000), now })
  ).filter(
    (row) => zonedToday(row.date).day === today.day,
  );
  const mark = () =>
    prisma.setting.upsert({
      where: { key: DIGEST_KEY },
      create: { key: DIGEST_KEY, value: today.day },
      update: { value: today.day },
    });
  if (!rows.length) {
    await mark();
    return { sent: false, reason: "none", absences: 0 };
  }
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", active: true, email: { not: null } },
    select: { email: true },
  });
  const recipients = admins.map((admin) => admin.email).filter((email): email is string => Boolean(email));
  if (!recipients.length) {
    await mark();
    return { sent: false, reason: "no-admin-email", absences: rows.length };
  }
  const label = dayLabel(rows[0].date);
  const lines = rows.map(
    (row) => `${teacherLabel(row)} · ${hours(row)} · ${row.courseName} · ${row.className}${row.room ? ` · salle ${row.room}` : ""}`,
  );
  const appUrl = process.env.APP_URL?.replace(/\/$/, "");
  try {
    const { from: sender, transporter } = createMailTransport();
    await transporter.sendMail({
      from: sender,
      to: recipients,
      subject: `Absences enseignants du ${label} : ${rows.length} séance(s) sans appel`,
      text: [
        "Bonjour,",
        "",
        `Séances du ${label} pour lesquelles l’appel n’a pas été fait :`,
        "",
        ...lines.map((line) => `- ${line}`),
        "",
        appUrl ? `Détail : ${appUrl}/admin/teacher-absences` : "",
        "ISSATKr Présence",
      ].join("\n"),
      html: `<p>Bonjour,</p>
        <p>Séances du ${escapeHtml(label)} pour lesquelles l’appel n’a pas été fait :</p>
        <ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
        ${appUrl ? `<p><a href="${escapeHtml(appUrl)}/admin/teacher-absences">Voir les absences enseignants</a></p>` : ""}
        <p>ISSATKr Présence</p>`,
      attachments: [{ filename: `absences-enseignants-${today.day}.xlsx`, content: teacherAbsenceWorkbook(rows) }],
    });
    transporter.close();
    await mark();
    return { sent: true, absences: rows.length, recipients: recipients.length };
  } catch (error) {
    // Not marked: retried at the next cron run.
    logServerError("mail.teacher-absence-digest", error);
    return { sent: false, reason: "smtp-error", absences: rows.length };
  }
}
