-- Tags become instance-wide.
--
-- They were scoped to a project, which cannot survive a ticket that has no
-- project. Same-named tags from different projects merge into one.

-- 1. Repoint every ticket link at the surviving tag for that name.
UPDATE "_TicketLabels" AS tl
SET "A" = keep.id
FROM "Label" AS dupe
JOIN (
    SELECT DISTINCT ON ("name") "name", "id"
    FROM "Label"
    ORDER BY "name", "createdAt", "id"
) AS keep ON keep."name" = dupe."name"
WHERE tl."A" = dupe."id" AND dupe."id" <> keep."id";

-- 2. A ticket could have carried both copies; drop the duplicate links.
DELETE FROM "_TicketLabels" a
USING "_TicketLabels" b
WHERE a.ctid > b.ctid AND a."A" = b."A" AND a."B" = b."B";

-- 3. Remove the now-unreferenced duplicates.
DELETE FROM "Label"
WHERE "id" NOT IN (
    SELECT DISTINCT ON ("name") "id"
    FROM "Label"
    ORDER BY "name", "createdAt", "id"
);

-- 4. Drop the project scoping.
DROP INDEX "Label_projectId_name_key";
DROP INDEX "Label_projectId_idx";
ALTER TABLE "Label" DROP CONSTRAINT "Label_projectId_fkey";
ALTER TABLE "Label" DROP COLUMN "projectId";
CREATE UNIQUE INDEX "Label_name_key" ON "Label"("name");

-- 5. New tags default to the brand colour.
ALTER TABLE "Label" ALTER COLUMN "color" SET DEFAULT '#febe2e';
