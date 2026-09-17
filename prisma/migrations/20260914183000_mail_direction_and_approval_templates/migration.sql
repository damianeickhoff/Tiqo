-- CreateEnum
CREATE TYPE "MailDirection" AS ENUM ('IN', 'OUT');

-- AlterEnum
ALTER TYPE "MailStatus" ADD VALUE 'SENDING';
ALTER TYPE "MailStatus" ADD VALUE 'RECEIVED';

-- AlterEnum
ALTER TYPE "MailTemplateKind" ADD VALUE 'APPROVAL_REQUESTED';
ALTER TYPE "MailTemplateKind" ADD VALUE 'APPROVAL_DECIDED';

-- AlterTable
ALTER TABLE "MailMessage" ADD COLUMN     "direction" "MailDirection" NOT NULL DEFAULT 'OUT';

-- CreateTable
CREATE TABLE "MailBounce" (
    "address" TEXT NOT NULL,
    "bouncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailBounce_pkey" PRIMARY KEY ("address")
);

-- CreateIndex
CREATE INDEX "MailMessage_direction_createdAt_idx" ON "MailMessage"("direction", "createdAt");
