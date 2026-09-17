-- Tickets stop borrowing their identity from a project.
--
-- Numbering used to come from Project.ticketCounter, which is what forced every
-- ticket into a project. Numbering now lives on an instance-wide counter, so a
-- project becomes what it should always have been: optional grouping.

-- 1. Instance-wide counters.
CREATE TABLE "Counter" (
    "id" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Counter_pkey" PRIMARY KEY ("id")
);

-- 2. Renumber every existing ticket on one sequence, oldest first, so the
--    order people already know is preserved.
DROP INDEX "Ticket_projectId_number_key";

WITH renumbered AS (
    SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS n
    FROM "Ticket"
)
UPDATE "Ticket" AS t
SET "number" = r.n
FROM renumbered AS r
WHERE t."id" = r."id";

-- 3. Start the counter past whatever is already in use.
INSERT INTO "Counter" ("id", "value")
VALUES ('ticket', COALESCE((SELECT MAX("number") FROM "Ticket"), 0));

-- 4. The number is the identity now; the project-prefixed key goes.
DROP INDEX "Ticket_key_key";
ALTER TABLE "Ticket" DROP COLUMN "key";
CREATE UNIQUE INDEX "Ticket_number_key" ON "Ticket"("number");

-- 5. A ticket may now stand alone. Deleting a project releases its tickets
--    rather than destroying them.
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_projectId_fkey";
ALTER TABLE "Ticket" ALTER COLUMN "projectId" DROP NOT NULL;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. Project no longer owns ticket numbering.
ALTER TABLE "Project" DROP COLUMN "ticketCounter";
