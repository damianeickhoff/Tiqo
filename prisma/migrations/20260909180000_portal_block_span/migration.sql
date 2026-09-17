-- A band's width becomes a column count, so the front page can be laid out by
-- dragging rather than by picking from three names.
ALTER TABLE "PortalBlock" ADD COLUMN "span" INTEGER NOT NULL DEFAULT 6;

UPDATE "PortalBlock" SET "span" = CASE "width"::text
  WHEN 'HALF' THEN 3
  WHEN 'THIRD' THEN 2
  ELSE 6
END;

ALTER TABLE "PortalBlock" DROP COLUMN "width";
DROP TYPE "PortalBlockWidth";
