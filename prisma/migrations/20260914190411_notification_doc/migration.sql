-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "docId" TEXT;

-- CreateIndex
CREATE INDEX "Notification_docId_idx" ON "Notification"("docId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_docId_fkey" FOREIGN KEY ("docId") REFERENCES "Doc"("id") ON DELETE CASCADE ON UPDATE CASCADE;
