-- CreateEnum
CREATE TYPE "AnnouncementTone" AS ENUM ('INFO', 'WARNING', 'OUTAGE');

-- CreateEnum
CREATE TYPE "PortalBlockKind" AS ENUM ('HERO', 'ANNOUNCEMENTS', 'CATEGORIES', 'FEATURED_FORMS', 'ARTICLES', 'MY_REQUESTS', 'RICH_TEXT');

-- AlterTable
ALTER TABLE "PortalCategory" ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "slug" TEXT;
UPDATE "PortalCategory" SET "slug" = "id" WHERE "slug" IS NULL;
ALTER TABLE "PortalCategory" ALTER COLUMN "slug" SET NOT NULL;

-- AlterTable
ALTER TABLE "PortalForm" ADD COLUMN     "confirmation" TEXT,
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "summary" TEXT;
UPDATE "PortalForm" SET "slug" = "id" WHERE "slug" IS NULL;
ALTER TABLE "PortalForm" ALTER COLUMN "slug" SET NOT NULL;

-- AlterTable
ALTER TABLE "PortalFormField" ADD COLUMN     "halfWidth" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "placeholder" TEXT,
ADD COLUMN     "sectionId" TEXT,
ADD COLUMN     "showWhenFieldId" TEXT,
ADD COLUMN     "showWhenValue" TEXT;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "portalFormId" TEXT;

-- CreateTable
CREATE TABLE "PortalFormSection" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL,

    CONSTRAINT "PortalFormSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalArticle" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "body" TEXT NOT NULL,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "categoryId" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalAnnouncement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "tone" "AnnouncementTone" NOT NULL DEFAULT 'INFO',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalBlock" (
    "id" TEXT NOT NULL,
    "kind" "PortalBlockKind" NOT NULL,
    "position" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "title" TEXT,
    "subtitle" TEXT,
    "limit" INTEGER DEFAULT 6,
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PortalFormSection_formId_position_idx" ON "PortalFormSection"("formId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "PortalArticle_slug_key" ON "PortalArticle"("slug");

-- CreateIndex
CREATE INDEX "PortalArticle_categoryId_position_idx" ON "PortalArticle"("categoryId", "position");

-- CreateIndex
CREATE INDEX "PortalBlock_position_idx" ON "PortalBlock"("position");

-- CreateIndex
CREATE UNIQUE INDEX "PortalCategory_slug_key" ON "PortalCategory"("slug");

-- CreateIndex
CREATE INDEX "PortalCategory_parentId_position_idx" ON "PortalCategory"("parentId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "PortalForm_slug_key" ON "PortalForm"("slug");

-- CreateIndex
CREATE INDEX "PortalFormField_sectionId_position_idx" ON "PortalFormField"("sectionId", "position");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_portalFormId_fkey" FOREIGN KEY ("portalFormId") REFERENCES "PortalForm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalCategory" ADD CONSTRAINT "PortalCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PortalCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalFormSection" ADD CONSTRAINT "PortalFormSection_formId_fkey" FOREIGN KEY ("formId") REFERENCES "PortalForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalFormField" ADD CONSTRAINT "PortalFormField_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "PortalFormSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalFormField" ADD CONSTRAINT "PortalFormField_showWhenFieldId_fkey" FOREIGN KEY ("showWhenFieldId") REFERENCES "PortalFormField"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalArticle" ADD CONSTRAINT "PortalArticle_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PortalCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalBlock" ADD CONSTRAINT "PortalBlock_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PortalCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

