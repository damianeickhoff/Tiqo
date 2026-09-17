-- CreateEnum
CREATE TYPE "MailTemplateKind" AS ENUM ('ASSIGNED', 'FORWARDED', 'COMMENTED', 'MENTIONED', 'ANSWERED', 'STATUS', 'BOUNCE');

-- CreateTable
CREATE TABLE "MailTemplate" (
    "kind" "MailTemplateKind" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailTemplate_pkey" PRIMARY KEY ("kind")
);
