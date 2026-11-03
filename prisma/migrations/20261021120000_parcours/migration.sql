-- CreateTable
CREATE TABLE "Parcours" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "domain" TEXT NOT NULL DEFAULT '',
    "mention" TEXT NOT NULL DEFAULT '',
    "specialty" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CourseElement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "parcoursId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "regime" TEXT NOT NULL DEFAULT '',
    "coefficient" REAL NOT NULL DEFAULT 0,
    "credits" REAL NOT NULL DEFAULT 0,
    "hoursLecture" REAL NOT NULL DEFAULT 0,
    "hoursTutorial" REAL NOT NULL DEFAULT 0,
    "hoursLab" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseElement_parcoursId_fkey" FOREIGN KEY ("parcoursId") REFERENCES "Parcours" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CourseElement_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Class" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "externalId" TEXT,
    "program" TEXT,
    "academicYear" TEXT,
    "semester" INTEGER,
    "levelId" TEXT,
    "parcoursId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Class_parcoursId_fkey" FOREIGN KEY ("parcoursId") REFERENCES "Parcours" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Class_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "AcademicLevel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Class" ("academicYear", "code", "createdAt", "externalId", "id", "levelId", "name", "program", "semester", "updatedAt") SELECT "academicYear", "code", "createdAt", "externalId", "id", "levelId", "name", "program", "semester", "updatedAt" FROM "Class";
DROP TABLE "Class";
ALTER TABLE "new_Class" RENAME TO "Class";
CREATE UNIQUE INDEX "Class_code_key" ON "Class"("code");
CREATE UNIQUE INDEX "Class_externalId_key" ON "Class"("externalId");
CREATE INDEX "Class_levelId_idx" ON "Class"("levelId");
CREATE INDEX "Class_parcoursId_idx" ON "Class"("parcoursId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Parcours_code_key" ON "Parcours"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CourseElement_code_key" ON "CourseElement"("code");

-- CreateIndex
CREATE INDEX "CourseElement_parcoursId_semester_idx" ON "CourseElement"("parcoursId", "semester");

-- CreateIndex
CREATE INDEX "CourseElement_subjectId_idx" ON "CourseElement"("subjectId");

