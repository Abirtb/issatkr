-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Attendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "present" BOOLEAN NOT NULL DEFAULT true,
    "justification" TEXT,
    "amendedAt" DATETIME,
    "amendedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attendance_amendedById_fkey" FOREIGN KEY ("amendedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Attendance" ("amendedAt", "createdAt", "id", "justification", "present", "sessionId", "studentId") SELECT "amendedAt", "createdAt", "id", "justification", "present", "sessionId", "studentId" FROM "Attendance";
DROP TABLE "Attendance";
ALTER TABLE "new_Attendance" RENAME TO "Attendance";
CREATE INDEX "Attendance_sessionId_idx" ON "Attendance"("sessionId");
CREATE INDEX "Attendance_amendedById_idx" ON "Attendance"("amendedById");
CREATE UNIQUE INDEX "Attendance_studentId_sessionId_key" ON "Attendance"("studentId", "sessionId");
CREATE TABLE "new_Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "classId" TEXT NOT NULL,
    "professorId" TEXT,
    "courseName" TEXT NOT NULL,
    "courseCode" TEXT,
    "date" DATETIME NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT,
    "room" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizedAt" DATETIME,
    CONSTRAINT "Session_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Session_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Session" ("classId", "courseCode", "courseName", "createdAt", "date", "endTime", "id", "room", "startTime") SELECT "classId", "courseCode", "courseName", "createdAt", "date", "endTime", "id", "room", "startTime" FROM "Session";
DROP TABLE "Session";
ALTER TABLE "new_Session" RENAME TO "Session";
CREATE INDEX "Session_classId_date_idx" ON "Session"("classId", "date");
CREATE INDEX "Session_professorId_date_idx" ON "Session"("professorId", "date");
CREATE TABLE "new_Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matricule" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "classId" TEXT NOT NULL,
    CONSTRAINT "Student_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Student" ("classId", "firstName", "id", "lastName", "matricule") SELECT "classId", "firstName", "id", "lastName", "matricule" FROM "Student";
DROP TABLE "Student";
ALTER TABLE "new_Student" RENAME TO "Student";
CREATE INDEX "Student_classId_idx" ON "Student"("classId");
CREATE INDEX "Student_classId_active_idx" ON "Student"("classId", "active");
CREATE UNIQUE INDEX "Student_matricule_classId_key" ON "Student"("matricule", "classId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
