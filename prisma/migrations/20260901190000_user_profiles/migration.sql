-- Accounts grow a directory profile: a split name, a handle, and the contact
-- and organisation fields a service desk needs to know who it is talking to.
ALTER TABLE "User" ADD COLUMN "username" TEXT;
ALTER TABLE "User" ADD COLUMN "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN "lastName" TEXT;
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "company" TEXT;
ALTER TABLE "User" ADD COLUMN "department" TEXT;
ALTER TABLE "User" ADD COLUMN "jobTitle" TEXT;

-- Existing rows only have a single display name: everything before the first
-- space is the given name, the remainder the family name.
UPDATE "User"
SET "firstName" = split_part("name", ' ', 1),
    "lastName"  = CASE
                    WHEN position(' ' IN "name") > 0
                    THEN substr("name", position(' ' IN "name") + 1)
                    ELSE ''
                  END;

-- Handles come from the email local part. Two addresses can share one, so the
-- second and later get a counter appended.
WITH candidates AS (
    SELECT "id",
        regexp_replace(lower(split_part("email", '@', 1)), '[^a-z0-9._-]', '', 'g') AS base,
        row_number() OVER (
            PARTITION BY regexp_replace(lower(split_part("email", '@', 1)), '[^a-z0-9._-]', '', 'g')
            ORDER BY "createdAt", "id"
        ) AS n
    FROM "User"
)
UPDATE "User" AS u
SET "username" = CASE WHEN c.n = 1 THEN c.base ELSE c.base || c.n::text END
FROM candidates AS c
WHERE u."id" = c."id";

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "firstName" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "lastName" SET NOT NULL;

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
