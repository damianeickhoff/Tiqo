/*
  Warnings:

  - You are about to drop the `PortalAsset` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "AvatarFallback" AS ENUM ('SILHOUETTE', 'INITIALS');

-- DropForeignKey
ALTER TABLE "PortalAsset" DROP CONSTRAINT "PortalAsset_uploadedById_fkey";

-- AlterTable
ALTER TABLE "Instance" ADD COLUMN     "avatarFallback" "AvatarFallback" NOT NULL DEFAULT 'INITIALS';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarImage" TEXT;

-- DropTable
DROP TABLE "PortalAsset";

-- CreateTable
CREATE TABLE "ImageAsset" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageAsset_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ImageAsset" ADD CONSTRAINT "ImageAsset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
