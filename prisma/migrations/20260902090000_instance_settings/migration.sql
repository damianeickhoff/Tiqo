-- Settings an admin edits at runtime: one row for the instance, one table per
-- list. Seeded here with the values that were hard-coded in the source, so an
-- upgraded instance looks exactly as it did before anyone opens Settings.
CREATE TABLE "Instance" (
    "id" TEXT NOT NULL DEFAULT 'instance',
    "brandColor" TEXT NOT NULL DEFAULT '#febe2e',
    "locale" TEXT NOT NULL DEFAULT 'en-GB',
    "selfRegistration" BOOLEAN NOT NULL DEFAULT true,
    "defaultType" "TicketType" NOT NULL DEFAULT 'QUESTION',
    "defaultPriority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "defaultProjectId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Instance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PriorityTarget" (
    "priority" "Priority" NOT NULL,
    "targetHours" INTEGER NOT NULL,

    CONSTRAINT "PriorityTarget_pkey" PRIMARY KEY ("priority")
);

CREATE TABLE "BlockedWord" (
    "id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedWord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BlockedWord_word_key" ON "BlockedWord"("word");

ALTER TABLE "Instance" ADD CONSTRAINT "Instance_defaultProjectId_fkey"
    FOREIGN KEY ("defaultProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "Instance" ("id", "updatedAt") VALUES ('instance', CURRENT_TIMESTAMP);

-- The targets the code shipped with.
INSERT INTO "PriorityTarget" ("priority", "targetHours") VALUES
    ('URGENT', 4),
    ('HIGH', 24),
    ('MEDIUM', 72),
    ('LOW', 168);
