-- Statuses become rows the desk owns. The five the app shipped with are kept
-- exactly as they were, so nothing on screen changes until someone edits them.
ALTER TYPE "TicketStatus" RENAME TO "TicketStatusLegacy";

CREATE TABLE "Status" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#9a9287',
    "settles" BOOLEAN NOT NULL DEFAULT false,
    "isClosing" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Status_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Status_name_key" ON "Status"("name");

INSERT INTO "Status" ("id", "name", "color", "settles", "isClosing", "isDefault", "position") VALUES
    ('status_open',        'Open',        '#e08a1e', false, false, true,  0),
    ('status_in_progress', 'In progress', '#7a6ff0', false, false, false, 1),
    ('status_blocked',     'Blocked',     '#db2777', false, false, false, 2),
    ('status_resolved',    'Resolved',    '#0e9e8a', true,  false, false, 3),
    ('status_closed',      'Closed',      '#9a9287', true,  true,  false, 4);

ALTER TABLE "Ticket" ADD COLUMN "statusId" TEXT;

UPDATE "Ticket" SET "statusId" = CASE "status"
    WHEN 'OPEN'        THEN 'status_open'
    WHEN 'IN_PROGRESS' THEN 'status_in_progress'
    WHEN 'BLOCKED'     THEN 'status_blocked'
    WHEN 'RESOLVED'    THEN 'status_resolved'
    ELSE 'status_closed'
END;

DROP INDEX "Ticket_status_idx";
ALTER TABLE "Ticket" DROP COLUMN "status";
DROP TYPE "TicketStatusLegacy";

CREATE INDEX "Ticket_statusId_idx" ON "Ticket"("statusId");
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_statusId_fkey"
    FOREIGN KEY ("statusId") REFERENCES "Status"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Business hours: the response clock only runs while the desk is open.
ALTER TABLE "Instance" ADD COLUMN "businessHours" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Instance" ADD COLUMN "businessDays" INTEGER[] DEFAULT ARRAY[1,2,3,4,5]::INTEGER[];
ALTER TABLE "Instance" ADD COLUMN "businessStart" INTEGER NOT NULL DEFAULT 540;
ALTER TABLE "Instance" ADD COLUMN "businessEnd" INTEGER NOT NULL DEFAULT 1020;
ALTER TABLE "Instance" ADD COLUMN "timeZone" TEXT NOT NULL DEFAULT 'Europe/Amsterdam';
