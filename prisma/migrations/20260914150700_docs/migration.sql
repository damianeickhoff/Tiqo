-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "docId" TEXT;

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "docId" TEXT,
ALTER COLUMN "ticketId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "DocSpace" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT NOT NULL DEFAULT '#febe2e',
    "position" INTEGER NOT NULL DEFAULT 0,
    "teamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocSpace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Doc" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "body" TEXT NOT NULL DEFAULT '',
    "spaceId" TEXT NOT NULL,
    "parentId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "ownerId" TEXT,
    "reviewDays" INTEGER NOT NULL DEFAULT 180,
    "reviewedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "articleId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Doc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocRevision" (
    "id" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "note" TEXT,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocSpace_key_key" ON "DocSpace"("key");

-- CreateIndex
CREATE INDEX "DocSpace_position_idx" ON "DocSpace"("position");

-- CreateIndex
CREATE UNIQUE INDEX "Doc_articleId_key" ON "Doc"("articleId");

-- CreateIndex
CREATE INDEX "Doc_spaceId_parentId_position_idx" ON "Doc"("spaceId", "parentId", "position");

-- CreateIndex
CREATE INDEX "Doc_ownerId_idx" ON "Doc"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Doc_spaceId_slug_key" ON "Doc"("spaceId", "slug");

-- CreateIndex
CREATE INDEX "DocRevision_docId_createdAt_idx" ON "DocRevision"("docId", "createdAt");

-- CreateIndex
CREATE INDEX "Activity_docId_createdAt_idx" ON "Activity"("docId", "createdAt");

-- CreateIndex
CREATE INDEX "Attachment_docId_createdAt_idx" ON "Attachment"("docId", "createdAt");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_docId_fkey" FOREIGN KEY ("docId") REFERENCES "Doc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_docId_fkey" FOREIGN KEY ("docId") REFERENCES "Doc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocSpace" ADD CONSTRAINT "DocSpace_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Doc" ADD CONSTRAINT "Doc_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "DocSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Doc" ADD CONSTRAINT "Doc_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Doc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Doc" ADD CONSTRAINT "Doc_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Doc" ADD CONSTRAINT "Doc_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "PortalArticle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Doc" ADD CONSTRAINT "Doc_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Doc" ADD CONSTRAINT "Doc_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocRevision" ADD CONSTRAINT "DocRevision_docId_fkey" FOREIGN KEY ("docId") REFERENCES "Doc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocRevision" ADD CONSTRAINT "DocRevision_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
