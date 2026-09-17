-- AlterTable
ALTER TABLE "PortalArticle" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "updatedById" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "locale" TEXT;

-- CreateTable
CREATE TABLE "PortalArticleTranslation" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "body" TEXT NOT NULL,

    CONSTRAINT "PortalArticleTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalFormTranslation" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "summary" TEXT,

    CONSTRAINT "PortalFormTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalFormFieldTranslation" (
    "id" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "hint" TEXT,
    "placeholder" TEXT,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "PortalFormFieldTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PortalArticleTranslation_articleId_locale_key" ON "PortalArticleTranslation"("articleId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "PortalFormTranslation_formId_locale_key" ON "PortalFormTranslation"("formId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "PortalFormFieldTranslation_fieldId_locale_key" ON "PortalFormFieldTranslation"("fieldId", "locale");

-- AddForeignKey
ALTER TABLE "PortalArticle" ADD CONSTRAINT "PortalArticle_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalArticle" ADD CONSTRAINT "PortalArticle_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalArticleTranslation" ADD CONSTRAINT "PortalArticleTranslation_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "PortalArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalFormTranslation" ADD CONSTRAINT "PortalFormTranslation_formId_fkey" FOREIGN KEY ("formId") REFERENCES "PortalForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalFormFieldTranslation" ADD CONSTRAINT "PortalFormFieldTranslation_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "PortalFormField"("id") ON DELETE CASCADE ON UPDATE CASCADE;
