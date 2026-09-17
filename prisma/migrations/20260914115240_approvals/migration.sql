-- CreateEnum
CREATE TYPE "ApprovalState" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApprovalRule" AS ENUM ('ALL', 'ANY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'APPROVAL_REQUESTED';
ALTER TYPE "ActivityType" ADD VALUE 'APPROVAL_GRANTED';
ALTER TYPE "ActivityType" ADD VALUE 'APPROVAL_REFUSED';
ALTER TYPE "ActivityType" ADD VALUE 'APPROVAL_CANCELLED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationKind" ADD VALUE 'APPROVAL_REQUESTED';
ALTER TYPE "NotificationKind" ADD VALUE 'APPROVAL_DECIDED';

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "phase" TEXT,
    "rule" "ApprovalRule" NOT NULL DEFAULT 'ALL',
    "state" "ApprovalState" NOT NULL DEFAULT 'PENDING',
    "question" TEXT,
    "dueAt" TIMESTAMP(3),
    "requestedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalResponse" (
    "id" TEXT NOT NULL,
    "approvalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "approved" BOOLEAN,
    "comment" TEXT,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "ApprovalResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Approval_ticketId_state_idx" ON "Approval"("ticketId", "state");

-- CreateIndex
CREATE INDEX "ApprovalResponse_userId_decidedAt_idx" ON "ApprovalResponse"("userId", "decidedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalResponse_approvalId_userId_key" ON "ApprovalResponse"("approvalId", "userId");

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalResponse" ADD CONSTRAINT "ApprovalResponse_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "Approval"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalResponse" ADD CONSTRAINT "ApprovalResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
