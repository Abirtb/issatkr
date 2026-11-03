-- CreateTable
CREATE TABLE "SubjectCurriculum" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subjectId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "specialty" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubjectCurriculum_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SubjectCurriculum_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "AcademicLevel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
INSERT INTO "new_WeeklySlot" ("classId", "createdAt", "endTime", "excludedDates", "id", "periodId", "professorId", "room", "startTime", "subjectId", "updatedAt", "weekday") SELECT "classId", "createdAt", "endTime", "excludedDates", "id", "periodId", "professorId", "room", "startTime", "subjectId", "updatedAt", "weekday" FROM "WeeklySlot";
DROP TABLE "WeeklySlot";
ALTER TABLE "new_WeeklySlot" RENAME TO "WeeklySlot";
CREATE INDEX "WeeklySlot_periodId_idx" ON "WeeklySlot"("periodId");
CREATE INDEX "WeeklySlot_classId_idx" ON "WeeklySlot"("classId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "SubjectCurriculum_levelId_specialty_idx" ON "SubjectCurriculum"("levelId", "specialty");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectCurriculum_subjectId_levelId_specialty_key" ON "SubjectCurriculum"("subjectId", "levelId", "specialty");

