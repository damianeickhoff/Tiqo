-- CreateEnum
CREATE TYPE "CiFieldKind" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'CHOICE', 'USER', 'ITEM');

-- CreateEnum
CREATE TYPE "CiLifecycle" AS ENUM ('PLANNED', 'IN_SERVICE', 'MAINTENANCE', 'RETIRED');

-- CreateEnum
CREATE TYPE "CiRelationKind" AS ENUM ('DEPENDS_ON', 'CONNECTS_TO', 'RUNS_ON', 'PART_OF');

-- CreateTable
CREATE TABLE "CiType" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT NOT NULL DEFAULT '#febe2e',
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CiType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CiTypeField" (
    "id" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" "CiFieldKind" NOT NULL DEFAULT 'TEXT',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CiTypeField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigurationItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "externalSource" TEXT,
    "externalId" TEXT,
    "ownerId" TEXT,
    "teamId" TEXT,
    "lifecycle" "CiLifecycle" NOT NULL DEFAULT 'IN_SERVICE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfigurationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CiRelation" (
    "id" TEXT NOT NULL,
    "kind" "CiRelationKind" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CiRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketCi" (
    "ticketId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketCi_pkey" PRIMARY KEY ("ticketId","itemId")
);

-- CreateIndex
CREATE UNIQUE INDEX "CiType_key_key" ON "CiType"("key");

-- CreateIndex
CREATE INDEX "CiTypeField_typeId_position_idx" ON "CiTypeField"("typeId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "CiTypeField_typeId_key_key" ON "CiTypeField"("typeId", "key");

-- CreateIndex
CREATE INDEX "ConfigurationItem_typeId_name_idx" ON "ConfigurationItem"("typeId", "name");

-- CreateIndex
CREATE INDEX "ConfigurationItem_name_idx" ON "ConfigurationItem"("name");

-- CreateIndex
CREATE INDEX "ConfigurationItem_lifecycle_idx" ON "ConfigurationItem"("lifecycle");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigurationItem_externalSource_externalId_key" ON "ConfigurationItem"("externalSource", "externalId");

-- CreateIndex
CREATE INDEX "CiRelation_targetId_idx" ON "CiRelation"("targetId");

-- CreateIndex
CREATE UNIQUE INDEX "CiRelation_sourceId_targetId_kind_key" ON "CiRelation"("sourceId", "targetId", "kind");

-- CreateIndex
CREATE INDEX "TicketCi_itemId_idx" ON "TicketCi"("itemId");

-- AddForeignKey
ALTER TABLE "CiTypeField" ADD CONSTRAINT "CiTypeField_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "CiType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigurationItem" ADD CONSTRAINT "ConfigurationItem_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "CiType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigurationItem" ADD CONSTRAINT "ConfigurationItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigurationItem" ADD CONSTRAINT "ConfigurationItem_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CiRelation" ADD CONSTRAINT "CiRelation_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ConfigurationItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CiRelation" ADD CONSTRAINT "CiRelation_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "ConfigurationItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketCi" ADD CONSTRAINT "TicketCi_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketCi" ADD CONSTRAINT "TicketCi_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ConfigurationItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

