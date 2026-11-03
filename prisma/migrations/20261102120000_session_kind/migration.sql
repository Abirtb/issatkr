-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "classId" TEXT NOT NULL,
    "professorId" TEXT,
    "subjectId" TEXT,
    "courseName" TEXT NOT NULL,
    "courseCode" TEXT,
    "date" DATETIME NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT,
    "room" TEXT,
    "subgroup" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizedAt" DATETIME,
    "weeklySlotId" TEXT,
    CONSTRAINT "Session_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Session_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Session_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Session_weeklySlotId_fkey" FOREIGN KEY ("weeklySlotId") REFERENCES "WeeklySlot" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Session" ("classId", "courseCode", "courseName", "createdAt", "date", "endTime", "finalizedAt", "id", "professorId", "room", "startTime", "subgroup", "subjectId", "weeklySlotId") SELECT "classId", "courseCode", "courseName", "createdAt", "date", "endTime", "finalizedAt", "id", "professorId", "room", "startTime", "subgroup", "subjectId", "weeklySlotId" FROM "Session";
DROP TABLE "Session";
ALTER TABLE "new_Session" RENAME TO "Session";
CREATE INDEX "Session_classId_date_idx" ON "Session"("classId", "date");
CREATE INDEX "Session_professorId_date_idx" ON "Session"("professorId", "date");
CREATE INDEX "Session_subjectId_date_idx" ON "Session"("subjectId", "date");
CREATE INDEX "Session_weeklySlotId_date_idx" ON "Session"("weeklySlotId", "date");
CREATE UNIQUE INDEX "Session_classId_courseName_date_startTime_subgroup_key" ON "Session"("classId", "courseName", "date", "startTime", "subgroup");
CREATE TABLE "new_WeeklySlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "periodId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "professorId" TEXT,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT,
    "room" TEXT,
    "subgroup" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT '',
    "intervalWeeks" INTEGER NOT NULL DEFAULT 1,
    "weekOffset" INTEGER NOT NULL DEFAULT 0,
    "excludedDates" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WeeklySlot_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AcademicPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WeeklySlot_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WeeklySlot_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WeeklySlot_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_WeeklySlot" ("classId", "createdAt", "endTime", "excludedDates", "id", "intervalWeeks", "periodId", "professorId", "room", "startTime", "subgroup", "subjectId", "updatedAt", "weekOffset", "weekday") SELECT "classId", "createdAt", "endTime", "excludedDates", "id", "intervalWeeks", "periodId", "professorId", "room", "startTime", "subgroup", "subjectId", "updatedAt", "weekOffset", "weekday" FROM "WeeklySlot";
DROP TABLE "WeeklySlot";
ALTER TABLE "new_WeeklySlot" RENAME TO "WeeklySlot";
CREATE INDEX "WeeklySlot_periodId_idx" ON "WeeklySlot"("periodId");
CREATE INDEX "WeeklySlot_classId_idx" ON "WeeklySlot"("classId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

