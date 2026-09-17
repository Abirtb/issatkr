ALTER TABLE "Class" ADD COLUMN "externalId" TEXT;
ALTER TABLE "Class" ADD COLUMN "program" TEXT;
ALTER TABLE "Class" ADD COLUMN "academicYear" TEXT;
ALTER TABLE "Class" ADD COLUMN "semester" INTEGER;

ALTER TABLE "Student" ADD COLUMN "cin" TEXT;
ALTER TABLE "Student" ADD COLUMN "firstNameAr" TEXT;
ALTER TABLE "Student" ADD COLUMN "lastNameAr" TEXT;
ALTER TABLE "Student" ADD COLUMN "email" TEXT;
ALTER TABLE "Student" ADD COLUMN "phone" TEXT;

CREATE UNIQUE INDEX "Class_externalId_key" ON "Class"("externalId");
