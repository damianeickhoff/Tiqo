-- Human ticket references, and a picked avatar per person.

ALTER TABLE "User" ADD COLUMN "avatarVariant" INTEGER NOT NULL DEFAULT 0;

-- 1. Add the reference nullable so existing rows can be filled in.
ALTER TABLE "Ticket" ADD COLUMN "reference" TEXT;

-- 2. Backfill: prefix by type, YYMM of filing, then a per-type-per-month
--    sequence in the order the tickets were actually raised.
WITH numbered AS (
    SELECT
        "id",
        CASE "type"
            WHEN 'INCIDENT' THEN 'INC'
            WHEN 'QUESTION' THEN 'QST'
            ELSE 'CHG'
        END AS prefix,
        to_char("createdAt", 'YYMM') AS period,
        ROW_NUMBER() OVER (
            PARTITION BY "type", to_char("createdAt", 'YYYYMM')
            ORDER BY "createdAt", "id"
        ) AS seq
    FROM "Ticket"
)
UPDATE "Ticket" AS t
SET "reference" = n.prefix || '-' || n.period || ' ' || lpad(n.seq::text, 4, '0')
FROM numbered AS n
WHERE t."id" = n."id";

ALTER TABLE "Ticket" ALTER COLUMN "reference" SET NOT NULL;
CREATE UNIQUE INDEX "Ticket_reference_key" ON "Ticket"("reference");

-- 3. Seed one counter per type-and-month bucket so new tickets carry on from
--    where the backfill left off rather than restarting at 0001.
INSERT INTO "Counter" ("id", "value")
SELECT
    'ticket:'
        || CASE "type"
            WHEN 'INCIDENT' THEN 'INC'
            WHEN 'QUESTION' THEN 'QST'
            ELSE 'CHG'
        END
        || ':' || to_char("createdAt", 'YYMM'),
    COUNT(*)
FROM "Ticket"
GROUP BY 1
ON CONFLICT ("id") DO UPDATE SET "value" = EXCLUDED."value";
