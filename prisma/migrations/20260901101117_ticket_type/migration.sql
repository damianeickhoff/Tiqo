-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('QUESTION', 'INCIDENT', 'CHANGE');

-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'TYPE_CHANGED';

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "type" "TicketType" NOT NULL DEFAULT 'QUESTION';
