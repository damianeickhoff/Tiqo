-- Every address a page has answered to, so a rename cannot break a link.
ALTER TABLE "Doc" ADD COLUMN "pastSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[];
