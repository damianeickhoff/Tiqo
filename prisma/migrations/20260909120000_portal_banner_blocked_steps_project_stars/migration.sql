-- A step can be stuck on something the plan cannot express.
ALTER TYPE "StepStatus" ADD VALUE IF NOT EXISTS 'BLOCKED' BEFORE 'DONE';

-- A notice can be pinned as the banner every portal page carries.
ALTER TABLE "PortalAnnouncement" ADD COLUMN IF NOT EXISTS "isBanner" BOOLEAN NOT NULL DEFAULT false;

-- Closing the portal has to say why.
ALTER TABLE "Instance" ADD COLUMN IF NOT EXISTS "portalClosedReason" TEXT;

-- A project somebody keeps an eye on.
CREATE TABLE IF NOT EXISTS "ProjectStar" (
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectStar_pkey" PRIMARY KEY ("userId","projectId")
);

CREATE INDEX IF NOT EXISTS "ProjectStar_userId_idx" ON "ProjectStar"("userId");

ALTER TABLE "ProjectStar" DROP CONSTRAINT IF EXISTS "ProjectStar_userId_fkey";
ALTER TABLE "ProjectStar" ADD CONSTRAINT "ProjectStar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectStar" DROP CONSTRAINT IF EXISTS "ProjectStar_projectId_fkey";
ALTER TABLE "ProjectStar" ADD CONSTRAINT "ProjectStar_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
