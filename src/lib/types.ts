export type AttendanceStatus = "present" | "absent" | "late" | "excused" | "unset";

export type WarningLevel = "none" | "watch" | "warning" | "critical";

export type Student = {
  id: string;
  firstName: string;
  lastName: string;
  registrationNumber: string;
  email: string;
  program: string;
  group: string;
  year: string;
  attendanceRate: number;
  absences: number;
  lateArrivals: number;
  warningLevel: WarningLevel;
};

export type Session = {
  id: string;
  course: string;
  courseCode: string;
  group: string;
  room: string;
  date: string;
  startTime: string;
  endTime: string;
  professor: string;
  studentIds: string[];
  recorded: boolean;
};

export type AttendanceRecord = {
  id: string;
  studentId: string;
  sessionId: string;
  status: AttendanceStatus;
  date: string;
  course: string;
};

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  time: string;
  unread: boolean;
  kind: "session" | "alert" | "system";
};
