-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'STEP_ADDED';
ALTER TYPE "ActivityType" ADD VALUE 'STEP_REMOVED';
ALTER TYPE "ActivityType" ADD VALUE 'STEP_DONE';
ALTER TYPE "ActivityType" ADD VALUE 'STEP_REOPENED';
ALTER TYPE "ActivityType" ADD VALUE 'PLAN_APPLIED';

-- CreateTable
CREATE TABLE "ChangeStep" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "assigneeId" TEXT,
    "doneAt" TIMESTAMP(3),
    "doneById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeTemplateStep" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "ChangeTemplateStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChangeStep_ticketId_position_idx" ON "ChangeStep"("ticketId", "position");

-- CreateIndex
CREATE INDEX "ChangeStep_assigneeId_idx" ON "ChangeStep"("assigneeId");

-- CreateIndex
CREATE UNIQUE INDEX "ChangeTemplate_name_key" ON "ChangeTemplate"("name");

-- CreateIndex
CREATE INDEX "ChangeTemplateStep_templateId_position_idx" ON "ChangeTemplateStep"("templateId", "position");

-- AddForeignKey
ALTER TABLE "ChangeStep" ADD CONSTRAINT "ChangeStep_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeStep" ADD CONSTRAINT "ChangeStep_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeStep" ADD CONSTRAINT "ChangeStep_doneById_fkey" FOREIGN KEY ("doneById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeTemplateStep" ADD CONSTRAINT "ChangeTemplateStep_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChangeTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
