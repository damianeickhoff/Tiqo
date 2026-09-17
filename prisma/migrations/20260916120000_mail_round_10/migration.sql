-- Mail, round 10: what the desk signs off with, and whether mail is working.
ALTER TABLE "MailSettings" ADD COLUMN "signature" TEXT;
ALTER TABLE "MailSettings" ADD COLUMN "lastSentAt" TIMESTAMP(3);
ALTER TABLE "MailSettings" ADD COLUMN "lastPolledAt" TIMESTAMP(3);
ALTER TABLE "MailSettings" ADD COLUMN "lastPollSummary" JSONB;

-- Which template wrote a message, so the wording table can count sends by kind.
ALTER TABLE "MailMessage" ADD COLUMN "kind" TEXT;
