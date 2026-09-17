-- Saved register views, per person.
ALTER TABLE "User" ADD COLUMN "ciViews" JSONB;

-- What a type's register looks like before anybody chooses, and the naming
-- convention its items are held to.
ALTER TABLE "CiType" ADD COLUMN "defaultColumns" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "CiType" ADD COLUMN "namePattern" TEXT;

-- Which dates run out.
ALTER TABLE "CiTypeField" ADD COLUMN "isExpiry" BOOLEAN NOT NULL DEFAULT false;
