-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'CI_CREATED';
ALTER TYPE "ActivityType" ADD VALUE 'CI_UPDATED';
ALTER TYPE "ActivityType" ADD VALUE 'CI_RELATED';
ALTER TYPE "ActivityType" ADD VALUE 'CI_UNRELATED';
ALTER TYPE "ActivityType" ADD VALUE 'CI_IMPORTED';

-- DropForeignKey
ALTER TABLE "ConfigurationItem" DROP CONSTRAINT "ConfigurationItem_ownerId_fkey";

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "itemId" TEXT;

-- AlterTable
ALTER TABLE "ConfigurationItem" DROP COLUMN "ownerId";

-- CreateIndex
CREATE INDEX "Activity_itemId_createdAt_idx" ON "Activity"("itemId", "createdAt");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ConfigurationItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

