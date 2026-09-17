-- A decision is one person's to make, and a refused change is cancelled.
--
-- Two changes that belong together: a request now names a single approver, so
-- the answer lives on the request itself rather than in a table of rows that
-- existed to hold a quorum; and a desk gains a status for the changes that were
-- refused, which is deliberately not the one Close uses.

-- Where a refused change goes.
ALTER TABLE "Status" ADD COLUMN "isCancelling" BOOLEAN NOT NULL DEFAULT false;

-- Every desk gets one, at the end of the board, so a refusal has somewhere to
-- send a change on the day this ships rather than after somebody has been into
-- Settings. Left alone where a desk already keeps a status of its own for this.
INSERT INTO "Status" (
    "id", "name", "color", "settles", "isClosing", "isDefault",
    "showOnPortal", "pausesClock", "isCancelling", "position"
)
SELECT
    'status_cancelled', 'Cancelled', '#b4302f', true, false, false,
    true, false, true,
    COALESCE((SELECT MAX("position") FROM "Status"), -1) + 1
WHERE NOT EXISTS (
    SELECT 1 FROM "Status" WHERE "isCancelling" OR lower("name") = 'cancelled'
);

-- One approver per request.
ALTER TABLE "Approval" ADD COLUMN "approverId" TEXT;
ALTER TABLE "Approval" ADD COLUMN "comment" TEXT;

-- Carry the answer that settled each round onto the round itself, falling back
-- to whoever was asked first. A round that carried three names keeps the one
-- whose answer decided it; the others were never going to be asked again.
UPDATE "Approval" a
SET "approverId" = r."userId", "comment" = r."comment"
FROM (
    SELECT DISTINCT ON ("approvalId") "approvalId", "userId", "comment"
    FROM "ApprovalResponse"
    ORDER BY "approvalId", ("approved" IS NOT NULL) DESC, "decidedAt" ASC NULLS LAST, "id" ASC
) r
WHERE r."approvalId" = a."id";

DROP TABLE "ApprovalResponse";

ALTER TABLE "Approval" DROP COLUMN "rule";
DROP TYPE "ApprovalRule";

ALTER TABLE "Approval" ADD CONSTRAINT "Approval_approverId_fkey"
    FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Approval_approverId_state_idx" ON "Approval"("approverId", "state");
