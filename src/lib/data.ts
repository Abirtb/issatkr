import type {
  AttendanceRecord,
  NotificationItem,
  Session,
  Student,
  WarningLevel,
} from "./types";

export const currentUser = {
  firstName: "Abir",
  lastName: "Trabelsi",
  title: "Maître assistante",
  department: "Département Informatique",
  email: "abir.trabelsi@issatkr.u-kairouan.tn",
};

export const students: Student[] = [
  {
    id: "s1",
    firstName: "Youssef",
    lastName: "Mansouri",
    registrationNumber: "2023GL001",
    email: "youssef.mansouri@issatkr.tn",
    program: "Génie Logiciel",
    group: "GL3-A",
    year: "3e année",
    attendanceRate: 97,
    absences: 1,
    lateArrivals: 0,
    warningLevel: "none",
  },
  {
    id: "s2",
    firstName: "Sarra",
    lastName: "Ben Amor",
    registrationNumber: "2023GL014",
    email: "sarra.benamor@issatkr.tn",
    program: "Génie Logiciel",
    group: "GL3-A",
    year: "3e année",
    attendanceRate: 92,
    absences: 2,
    lateArrivals: 1,
    warningLevel: "none",
  },
  {
    id: "s3",
    firstName: "Mehdi",
    lastName: "Khelifi",
    registrationNumber: "2023GL008",
    email: "mehdi.khelifi@issatkr.tn",
    program: "Génie Logiciel",
    group: "GL3-A",
    year: "3e année",
    attendanceRate: 78,
    absences: 6,
    lateArrivals: 3,
    warningLevel: "warning",
  },
  {
    id: "s4",
    firstName: "Nour",
    lastName: "Jaziri",
    registrationNumber: "2023GL021",
    email: "nour.jaziri@issatkr.tn",
    program: "Génie Logiciel",
    group: "GL3-A",
    year: "3e année",
    attendanceRate: 88,
    absences: 3,
    lateArrivals: 2,
    warningLevel: "watch",
  },
  {
    id: "s5",
    firstName: "Amine",
    lastName: "Bouzid",
    registrationNumber: "2023GL005",
    email: "amine.bouzid@issatkr.tn",
    program: "Génie Logiciel",
    group: "GL3-A",
    year: "3e année",
    attendanceRate: 95,
    absences: 1,
    lateArrivals: 1,
    warningLevel: "none",
  },
  {
    id: "s6",
    firstName: "Ines",
    lastName: "Cherif",
    registrationNumber: "2023GL019",
    email: "ines.cherif@issatkr.tn",
    program: "Génie Logiciel",
    group: "GL3-A",
    year: "3e année",
    attendanceRate: 64,
    absences: 11,
    lateArrivals: 4,
    warningLevel: "critical",
  },
  {
    id: "s7",
    firstName: "Rami",
    lastName: "Gharbi",
    registrationNumber: "2023GL011",
    email: "rami.gharbi@issatkr.tn",
    program: "Génie Logiciel",
    group: "GL3-A",
    year: "3e année",
    attendanceRate: 91,
    absences: 2,
    lateArrivals: 0,
    warningLevel: "none",
  },
  {
    id: "s8",
    firstName: "Aya",
    lastName: "Hammami",
    registrationNumber: "2023GL027",
    email: "aya.hammami@issatkr.tn",
    program: "Génie Logiciel",
    group: "GL3-A",
    year: "3e année",
    attendanceRate: 86,
    absences: 4,
    lateArrivals: 1,
    warningLevel: "watch",
  },
  {
    id: "s9",
    firstName: "Oussama",
    lastName: "Triki",
    registrationNumber: "2023GL016",
    email: "oussama.triki@issatkr.tn",
    program: "Génie Logiciel",
    group: "GL3-A",
    year: "3e année",
    attendanceRate: 99,
    absences: 0,
    lateArrivals: 1,
    warningLevel: "none",
  },
  {
    id: "s10",
    firstName: "Hiba",
    lastName: "Mabrouk",
    registrationNumber: "2023GL003",
    email: "hiba.mabrouk@issatkr.tn",
    program: "Génie Logiciel",
    group: "GL3-A",
    year: "3e année",
    attendanceRate: 83,
    absences: 5,
    lateArrivals: 2,
    warningLevel: "watch",
  },
  {
    id: "s11",
    firstName: "Karim",
    lastName: "Saidi",
    registrationNumber: "2023GL030",
    email: "karim.saidi@issatkr.tn",
    program: "Génie Logiciel",
    group: "GL3-A",
    year: "3e année",
    attendanceRate: 90,
    absences: 2,
    lateArrivals: 2,
    warningLevel: "none",
  },
  {
    id: "s12",
    firstName: "Lina",
    lastName: "Ferjani",
    registrationNumber: "2023GL022",
    email: "lina.ferjani@issatkr.tn",
    program: "Génie Logiciel",
    group: "GL3-A",
    year: "3e année",
    attendanceRate: 94,
    absences: 1,
    lateArrivals: 0,
    warningLevel: "none",
  },
];

export const sessions: Session[] = [
  {
    id: "ses-today",
    course: "Architecture des systèmes distribués",
    courseCode: "ASD-401",
    group: "GL3-A",
    room: "Amphi B",
    date: "2026-09-02",
    startTime: "08:30",
    endTime: "10:00",
    professor: "Abir Trabelsi",
    studentIds: students.map((s) => s.id),
    recorded: false,
  },
  {
    id: "ses-2",
    course: "Intelligence artificielle",
    courseCode: "IA-310",
    group: "GL3-A",
    room: "Lab 2",
    date: "2026-09-02",
    startTime: "14:00",
    endTime: "15:30",
    professor: "Abir Trabelsi",
    studentIds: students.map((s) => s.id),
    recorded: false,
  },
  {
    id: "ses-3",
    course: "Génie logiciel avancé",
    courseCode: "GLA-320",
    group: "GL3-A",
    room: "Salle 12",
    date: "2026-09-01",
    startTime: "10:15",
    endTime: "11:45",
    professor: "Abir Trabelsi",
    studentIds: students.map((s) => s.id),
    recorded: true,
  },
  {
    id: "ses-4",
    course: "Bases de données avancées",
    courseCode: "BDA-220",
    group: "GL3-A",
    room: "Lab 1",
    date: "2026-08-29",
    startTime: "08:30",
    endTime: "10:00",
    professor: "Abir Trabelsi",
    studentIds: students.map((s) => s.id),
    recorded: true,
  },
];

export const weeklyPresence = [
  { day: "Lun", present: 94, absent: 6 },
  { day: "Mar", present: 91, absent: 9 },
  { day: "Mer", present: 88, absent: 12 },
  { day: "Jeu", present: 96, absent: 4 },
  { day: "Ven", present: 90, absent: 10 },
];

export const courseBreakdown = [
  { course: "ASD-401", rate: 93 },
  { course: "IA-310", rate: 89 },
  { course: "GLA-320", rate: 96 },
  { course: "BDA-220", rate: 84 },
];

export const attendanceHistory: AttendanceRecord[] = [
  { id: "h1", studentId: "s3", sessionId: "ses-3", status: "absent", date: "2026-09-01", course: "Génie logiciel avancé" },
  { id: "h2", studentId: "s6", sessionId: "ses-3", status: "absent", date: "2026-09-01", course: "Génie logiciel avancé" },
  { id: "h3", studentId: "s8", sessionId: "ses-3", status: "late", date: "2026-09-01", course: "Génie logiciel avancé" },
  { id: "h4", studentId: "s4", sessionId: "ses-4", status: "late", date: "2026-08-29", course: "Bases de données avancées" },
  { id: "h5", studentId: "s6", sessionId: "ses-4", status: "absent", date: "2026-08-29", course: "Bases de données avancées" },
  { id: "h6", studentId: "s10", sessionId: "ses-4", status: "excused", date: "2026-08-29", course: "Bases de données avancées" },
];

export const studentTimeline: Record<string, AttendanceRecord[]> = {
  s3: [
    { id: "t1", studentId: "s3", sessionId: "ses-3", status: "absent", date: "2026-09-01", course: "Génie logiciel avancé" },
    { id: "t2", studentId: "s3", sessionId: "ses-4", status: "late", date: "2026-08-29", course: "Bases de données avancées" },
    { id: "t3", studentId: "s3", sessionId: "x1", status: "present", date: "2026-08-27", course: "Intelligence artificielle" },
    { id: "t4", studentId: "s3", sessionId: "x2", status: "absent", date: "2026-08-25", course: "Architecture des systèmes distribués" },
    { id: "t5", studentId: "s3", sessionId: "x3", status: "present", date: "2026-08-22", course: "Génie logiciel avancé" },
    { id: "t6", studentId: "s3", sessionId: "x4", status: "late", date: "2026-08-20", course: "Bases de données avancées" },
  ],
  s6: [
    { id: "u1", studentId: "s6", sessionId: "ses-3", status: "absent", date: "2026-09-01", course: "Génie logiciel avancé" },
    { id: "u2", studentId: "s6", sessionId: "ses-4", status: "absent", date: "2026-08-29", course: "Bases de données avancées" },
    { id: "u3", studentId: "s6", sessionId: "x1", status: "absent", date: "2026-08-27", course: "Intelligence artificielle" },
    { id: "u4", studentId: "s6", sessionId: "x2", status: "late", date: "2026-08-25", course: "Architecture des systèmes distribués" },
    { id: "u5", studentId: "s6", sessionId: "x3", status: "absent", date: "2026-08-22", course: "Génie logiciel avancé" },
    { id: "u6", studentId: "s6", sessionId: "x4", status: "present", date: "2026-08-20", course: "Bases de données avancées" },
  ],
};

export const notifications: NotificationItem[] = [
  {
    id: "n1",
    title: "Séance à enregistrer",
    body: "Architecture des systèmes distribués · GL3-A · 08:30",
    time: "Il y a 12 min",
    unread: true,
    kind: "session",
  },
  {
    id: "n2",
    title: "Seuil d’absences atteint",
    body: "Ines Cherif a dépassé le seuil critique d’absences.",
    time: "Il y a 2 h",
    unread: true,
    kind: "alert",
  },
  {
    id: "n3",
    title: "Présence validée",
    body: "Génie logiciel avancé du 1er septembre a été enregistrée.",
    time: "Hier",
    unread: false,
    kind: "system",
  },
];

export const warningCopy: Record<WarningLevel, string> = {
  none: "Aucun",
  watch: "Surveillance",
  warning: "Avertissement",
  critical: "Critique",
};

export function getStudent(id: string) {
  return students.find((s) => s.id === id);
}

export function getSession(id: string) {
  return sessions.find((s) => s.id === id);
}

export function initials(first: string, last: string) {
  return `${first[0]}${last[0]}`.toUpperCase();
}

export function formatLongDate(iso: string) {
  return new Intl.DateTimeFormat("fr-TN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}
