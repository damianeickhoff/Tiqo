-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "stepId" TEXT;

-- CreateIndex
CREATE INDEX "Activity_stepId_createdAt_idx" ON "Activity"("stepId", "createdAt");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "ChangeStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

