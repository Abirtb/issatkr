INSERT OR IGNORE INTO "Subject" (
  "id",
  "code",
  "name",
  "active",
  "createdAt",
  "updatedAt"
)
SELECT
  'legacy-' || lower(hex(randomblob(16))),
  COALESCE(
    NULLIF(upper(trim("courseCode")), ''),
    'LEGACY-' || printf('%08d', MIN(rowid))
  ),
  "courseName",
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Session"
WHERE "subjectId" IS NULL
GROUP BY "courseName", "courseCode";

UPDATE "Session"
SET "subjectId" = (
  SELECT "Subject"."id"
  FROM "Subject"
  WHERE "Subject"."name" = "Session"."courseName"
    AND (
      "Session"."courseCode" IS NULL
      OR "Session"."courseCode" = ''
      OR "Subject"."code" = upper(trim("Session"."courseCode"))
    )
  LIMIT 1
)
WHERE "subjectId" IS NULL;
