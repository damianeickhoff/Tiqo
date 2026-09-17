-- CreateTable
CREATE TABLE "PortalArticleVote" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "helpful" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalArticleVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PortalArticleVote_articleId_createdAt_idx" ON "PortalArticleVote"("articleId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PortalArticleVote_articleId_userId_key" ON "PortalArticleVote"("articleId", "userId");

-- AddForeignKey
ALTER TABLE "PortalArticleVote" ADD CONSTRAINT "PortalArticleVote_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "PortalArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalArticleVote" ADD CONSTRAINT "PortalArticleVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
