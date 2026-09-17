-- AlterTable
ALTER TABLE "ChangeStep" ADD COLUMN     "dependsOnId" TEXT,
ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "phase" TEXT,
ADD COLUMN     "phaseOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ChangeTemplateStep" ADD COLUMN     "assigneeId" TEXT,
ADD COLUMN     "dependsOnId" TEXT,
ADD COLUMN     "dueDays" INTEGER,
ADD COLUMN     "phaseId" TEXT;

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "stepId" TEXT;

-- CreateTable
CREATE TABLE "ChangeTemplatePhase" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "ChangeTemplatePhase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChangeTemplatePhase_templateId_position_idx" ON "ChangeTemplatePhase"("templateId", "position");

-- CreateIndex
CREATE INDEX "ChangeTemplateStep_phaseId_idx" ON "ChangeTemplateStep"("phaseId");

-- CreateIndex
CREATE INDEX "Comment_stepId_createdAt_idx" ON "Comment"("stepId", "createdAt");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "ChangeStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeStep" ADD CONSTRAINT "ChangeStep_dependsOnId_fkey" FOREIGN KEY ("dependsOnId") REFERENCES "ChangeStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeTemplatePhase" ADD CONSTRAINT "ChangeTemplatePhase_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChangeTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeTemplateStep" ADD CONSTRAINT "ChangeTemplateStep_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "ChangeTemplatePhase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeTemplateStep" ADD CONSTRAINT "ChangeTemplateStep_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeTemplateStep" ADD CONSTRAINT "ChangeTemplateStep_dependsOnId_fkey" FOREIGN KEY ("dependsOnId") REFERENCES "ChangeTemplateStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;
