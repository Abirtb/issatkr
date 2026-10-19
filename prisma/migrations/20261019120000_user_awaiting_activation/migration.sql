-- AlterTable
ALTER TABLE "User" ADD COLUMN "awaitingActivation" BOOLEAN NOT NULL DEFAULT false;

-- Accounts invited before this change and never activated (no invitation used).
UPDATE "User" SET "awaitingActivation" = true
WHERE "id" IN (
    SELECT "userId" FROM "AccountToken"
    WHERE "purpose" = 'INVITE'
    GROUP BY "userId"
    HAVING SUM(CASE WHEN "usedAt" IS NOT NULL THEN 1 ELSE 0 END) = 0
);
