-- CreateEnum
CREATE TYPE "TicketLinkKind" AS ENUM ('RELATES_TO', 'DUPLICATES', 'BLOCKS', 'CAUSED_BY', 'PARENT_OF');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'LINKED';
ALTER TYPE "ActivityType" ADD VALUE 'UNLINKED';

-- CreateTable
CREATE TABLE "TicketLink" (
    "id" TEXT NOT NULL,
    "kind" "TicketLinkKind" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TicketLink_targetId_idx" ON "TicketLink"("targetId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketLink_sourceId_targetId_kind_key" ON "TicketLink"("sourceId", "targetId", "kind");

-- AddForeignKey
ALTER TABLE "TicketLink" ADD CONSTRAINT "TicketLink_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketLink" ADD CONSTRAINT "TicketLink_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketLink" ADD CONSTRAINT "TicketLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
