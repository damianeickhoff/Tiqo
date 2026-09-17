-- AlterTable
ALTER TABLE "Status" ADD COLUMN     "onReplyStatusId" TEXT,
ADD COLUMN     "pausesClock" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "pausedMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pausedSince" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Status" ADD CONSTRAINT "Status_onReplyStatusId_fkey" FOREIGN KEY ("onReplyStatusId") REFERENCES "Status"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- The desk already has the two states this was built for, so wire them up:
-- "Waiting on user" stops the clock, and a reply moves the ticket to
-- "Reply received". Both are only defaults — either can be changed, and an
-- instance without those names is left alone.
UPDATE "Status" SET "pausesClock" = true WHERE lower(name) = 'waiting on user';

UPDATE "Status" SET "onReplyStatusId" = (SELECT id FROM "Status" WHERE lower(name) = 'reply received' LIMIT 1)
WHERE lower(name) = 'waiting on user'
  AND EXISTS (SELECT 1 FROM "Status" WHERE lower(name) = 'reply received');
