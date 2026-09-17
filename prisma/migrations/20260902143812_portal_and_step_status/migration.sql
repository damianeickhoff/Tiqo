-- CreateEnum
CREATE TYPE "StepStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'SKIPPED');

-- CreateEnum
CREATE TYPE "PortalFieldKind" AS ENUM ('TEXT', 'TEXTAREA', 'SELECT', 'DATE', 'CHECKBOX');

-- CreateEnum
CREATE TYPE "PortalFieldTarget" AS ENUM ('NONE', 'TITLE', 'DESCRIPTION');

-- AlterTable
ALTER TABLE "ChangeStep" ADD COLUMN     "description" TEXT,
ADD COLUMN     "status" "StepStatus" NOT NULL DEFAULT 'OPEN';

-- AlterTable
ALTER TABLE "ChangeTemplateStep" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "Instance" ADD COLUMN     "portalEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "portalTitle" TEXT NOT NULL DEFAULT 'Service portal',
ADD COLUMN     "portalWelcome" TEXT NOT NULL DEFAULT 'Tell us what you need and we will pick it up.';

-- CreateTable
CREATE TABLE "PortalCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "image" TEXT,
    "color" TEXT NOT NULL DEFAULT '#febe2e',
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalForm" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT NOT NULL DEFAULT '#febe2e',
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "categoryId" TEXT,
    "type" "TicketType" NOT NULL DEFAULT 'QUESTION',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "teamId" TEXT,
    "projectId" TEXT,
    "planId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalFormField" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "hint" TEXT,
    "kind" "PortalFieldKind" NOT NULL DEFAULT 'TEXT',
    "target" "PortalFieldTarget" NOT NULL DEFAULT 'NONE',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "position" INTEGER NOT NULL,

    CONSTRAINT "PortalFormField_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PortalForm_categoryId_position_idx" ON "PortalForm"("categoryId", "position");

-- CreateIndex
CREATE INDEX "PortalFormField_formId_position_idx" ON "PortalFormField"("formId", "position");

-- AddForeignKey
ALTER TABLE "PortalForm" ADD CONSTRAINT "PortalForm_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PortalCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalForm" ADD CONSTRAINT "PortalForm_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalForm" ADD CONSTRAINT "PortalForm_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalForm" ADD CONSTRAINT "PortalForm_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ChangeTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalFormField" ADD CONSTRAINT "PortalFormField_formId_fkey" FOREIGN KEY ("formId") REFERENCES "PortalForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
