-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'REPORTER_CHANGED';

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "createdById" TEXT;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: every ticket that existed before this column was filed by the
-- person it was reported for, so the two were the same by definition.
UPDATE "Ticket" SET "createdById" = "reporterId" WHERE "createdById" IS NULL;
