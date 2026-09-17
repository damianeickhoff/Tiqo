-- Why a step is stuck, in the words of whoever stopped it.
ALTER TABLE "ChangeStep" ADD COLUMN IF NOT EXISTS "blockedReason" TEXT;

-- How wide a front-page band sits, so the portal can be laid out in columns.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PortalBlockWidth') THEN
    CREATE TYPE "PortalBlockWidth" AS ENUM ('FULL', 'HALF', 'THIRD');
  END IF;
END
$$;

ALTER TABLE "PortalBlock"
  ADD COLUMN IF NOT EXISTS "width" "PortalBlockWidth" NOT NULL DEFAULT 'FULL';
