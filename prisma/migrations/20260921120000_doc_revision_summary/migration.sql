-- A revision keeps the summary as well as the title and the body. Rewriting
-- the one sentence that stands in for a page in every list was leaving no
-- trace at all, and never reached the portal answer made from it.
ALTER TABLE "DocRevision" ADD COLUMN "summary" TEXT;

-- `Doc.updatedAt` stops being client-managed. It now means "when the words
-- were last written", set by the two actions that write them, so confirming,
-- snoozing, re-owning, moving or archiving a page no longer reads as an edit.
ALTER TABLE "Doc" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
