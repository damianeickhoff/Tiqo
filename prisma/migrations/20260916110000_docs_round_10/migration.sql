-- Documentation, round 10: pinning, per-shelf review intervals, and the
-- desk-wide review defaults the stale sweep reads.

-- How a person likes the documentation drawn.
ALTER TABLE "User" ADD COLUMN "docPrefs" TEXT;

-- What a lapse has already cost in reminders, and a snooze for somebody who
-- knows the page is due and cannot read it today.
ALTER TABLE "Doc" ADD COLUMN "staleReminders" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Doc" ADD COLUMN "staleSnoozedTo" TIMESTAMP(3);

-- A shelf's own review interval and its proposed portal section.
ALTER TABLE "DocSpace" ADD COLUMN "reviewDays" INTEGER NOT NULL DEFAULT 180;
ALTER TABLE "DocSpace" ADD COLUMN "portalCategoryId" TEXT;
ALTER TABLE "DocSpace" ADD CONSTRAINT "DocSpace_portalCategoryId_fkey"
  FOREIGN KEY ("portalCategoryId") REFERENCES "PortalCategory"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- How the desk chases a review.
ALTER TABLE "Instance" ADD COLUMN "docRemindDays" INTEGER NOT NULL DEFAULT 7;
ALTER TABLE "Instance" ADD COLUMN "docRemindEveryDays" INTEGER NOT NULL DEFAULT 14;
ALTER TABLE "Instance" ADD COLUMN "docEscalateToTeam" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Instance" ADD COLUMN "docEditCountsAsReview" BOOLEAN NOT NULL DEFAULT true;

-- A page somebody keeps coming back to.
CREATE TABLE "DocStar" (
  "userId" TEXT NOT NULL,
  "docId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocStar_pkey" PRIMARY KEY ("userId","docId")
);

CREATE INDEX "DocStar_userId_idx" ON "DocStar"("userId");

ALTER TABLE "DocStar" ADD CONSTRAINT "DocStar_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocStar" ADD CONSTRAINT "DocStar_docId_fkey"
  FOREIGN KEY ("docId") REFERENCES "Doc"("id") ON DELETE CASCADE ON UPDATE CASCADE;
