-- Change template designer: what a plan step says about itself, and where a plan is used.

-- AlterTable
ALTER TABLE "ChangeTemplate" ADD COLUMN "defaultAssigneeId" TEXT;

-- AlterTable
ALTER TABLE "ChangeTemplateStep" ADD COLUMN "teamId" TEXT,
ADD COLUMN "estimateMinutes" INTEGER,
ADD COLUMN "blocksPhase" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "skipNeedsReason" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ChangeStep" ADD COLUMN "teamId" TEXT,
ADD COLUMN "estimateMinutes" INTEGER,
ADD COLUMN "blocksPhase" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "skipNeedsReason" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "skipReason" TEXT;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "templateId" TEXT;

-- CreateIndex
CREATE INDEX "Ticket_templateId_idx" ON "Ticket"("templateId");

-- AddForeignKey
ALTER TABLE "ChangeTemplate" ADD CONSTRAINT "ChangeTemplate_defaultAssigneeId_fkey" FOREIGN KEY ("defaultAssigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeTemplateStep" ADD CONSTRAINT "ChangeTemplateStep_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeStep" ADD CONSTRAINT "ChangeStep_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChangeTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
