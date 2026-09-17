/*
  Warnings:

  - You are about to drop the column `icon` on the `DocSpace` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "MailTemplateKind" ADD VALUE 'RECEIVED';

-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'RAISED';

-- AlterTable
ALTER TABLE "DocSpace" DROP COLUMN "icon";
