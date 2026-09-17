-- Reference entries written before the trail carried a link, and before a
-- project was named rather than keyed. Without this they render as plain text
-- while every new one is clickable, which reads as a bug rather than as history.

-- Where the thing is. The stored label is what was written, so the sigil comes
-- off before it is matched.
UPDATE "Activity" a
SET link = '/tickets/' || t.number
FROM "Ticket" t
WHERE a.type = 'REFERENCED'
  AND a.link IS NULL
  AND a.field = 'ticket'
  AND t.reference = ltrim(coalesce(a."newValue", a."oldValue"), '#');

UPDATE "Activity" a
SET link = '/projects/' || p.key
FROM "Project" p
WHERE a.type = 'REFERENCED'
  AND a.link IS NULL
  AND a.field = 'project'
  AND p.key = ltrim(coalesce(a."newValue", a."oldValue"), '#');

UPDATE "Activity" a
SET link = '/people/' || u.id
FROM "User" u
WHERE a.type = 'REFERENCED'
  AND a.link IS NULL
  AND a.field = 'user'
  AND u.username = ltrim(coalesce(a."newValue", a."oldValue"), '@');

-- And what it is called: a project reads by name in a sentence, both for the
-- half that points out and the half that points back.
UPDATE "Activity" a
SET "newValue" = p.name
FROM "Project" p
WHERE a.type = 'REFERENCED'
  AND a.field = 'project'
  AND a."newValue" IS NOT NULL
  AND ltrim(a."newValue", '#') = p.key;

UPDATE "Activity" a
SET "oldValue" = p.name
FROM "Project" p
WHERE a.type = 'REFERENCED'
  AND a.field = 'project'
  AND a."newValue" IS NULL
  AND a."oldValue" = p.key;
