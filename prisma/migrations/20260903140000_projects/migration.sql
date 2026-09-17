-- Projects become bodies of work rather than labels: they carry how they are
-- going, who answers for them, when they are meant to land, who is on them, and
-- the dated points they are working towards.

CREATE TYPE "ProjectHealth" AS ENUM ('ON_TRACK', 'AT_RISK', 'OFF_TRACK', 'PAUSED', 'DELIVERED');

ALTER TABLE "Project"
    ADD COLUMN "health"   "ProjectHealth" NOT NULL DEFAULT 'ON_TRACK',
    ADD COLUMN "headline" TEXT,
    ADD COLUMN "startsOn" TIMESTAMP(3),
    ADD COLUMN "dueOn"    TIMESTAMP(3),
    ADD COLUMN "leadId"   TEXT;

CREATE INDEX "Project_leadId_idx" ON "Project"("leadId");

ALTER TABLE "Project" ADD CONSTRAINT "Project_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Who is on it. The lead is a column above; this is the roster.
CREATE TABLE "_ProjectMembers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ProjectMembers_AB_pkey" PRIMARY KEY ("A","B")
);

CREATE INDEX "_ProjectMembers_B_index" ON "_ProjectMembers"("B");

ALTER TABLE "_ProjectMembers" ADD CONSTRAINT "_ProjectMembers_A_fkey"
    FOREIGN KEY ("A") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_ProjectMembers" ADD CONSTRAINT "_ProjectMembers_B_fkey"
    FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A dated point tickets are filed against. Deliberately not a sprint: a desk
-- plans around the date something has to be true by, not a fixed-length box.
CREATE TABLE "Milestone" (
    "id"          TEXT NOT NULL,
    "projectId"   TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "description" TEXT,
    "dueOn"       TIMESTAMP(3),
    "reachedAt"   TIMESTAMP(3),
    "position"    INTEGER NOT NULL DEFAULT 0,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Milestone_projectId_position_idx" ON "Milestone"("projectId", "position");

ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Losing the milestone must never take the ticket with it.
ALTER TABLE "Ticket" ADD COLUMN "milestoneId" TEXT;

ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_milestoneId_fkey"
    FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
