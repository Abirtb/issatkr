CREATE UNIQUE INDEX "Session_classId_courseName_date_startTime_key"
ON "Session"("classId", "courseName", "date", "startTime");
