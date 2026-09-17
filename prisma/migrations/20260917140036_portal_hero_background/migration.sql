-- CreateEnum
CREATE TYPE "PortalHeroStyle" AS ENUM ('BRAND', 'SOLID', 'GRADIENT', 'IMAGE');

-- AlterTable
ALTER TABLE "PortalBlock" ADD COLUMN     "heroColor" TEXT,
ADD COLUMN     "heroColor2" TEXT,
ADD COLUMN     "heroImage" TEXT,
ADD COLUMN     "heroStyle" "PortalHeroStyle" NOT NULL DEFAULT 'BRAND';
