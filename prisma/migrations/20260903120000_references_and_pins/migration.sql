-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "projectId" TEXT,
ALTER COLUMN "ticketId" DROP NOT NULL;
-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "pinnedAt" TIMESTAMP(3);
-- CreateIndex
CREATE INDEX "Activity_projectId_createdAt_idx" ON "Activity"("projectId", "createdAt");
-- CreateIndex
CREATE INDEX "Comment_ticketId_pinnedAt_idx" ON "Comment"("ticketId", "pinnedAt");
-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
