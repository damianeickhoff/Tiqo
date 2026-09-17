-- Roles become rows an admin can edit, and teams replace the idea of first and
-- second line: a ticket belongs to whichever desk owns the work.

-- The enum holds the name the table wants, and User.role still depends on it,
-- so it steps aside first and is dropped once the column is gone.
ALTER TYPE "Role" RENAME TO "RoleLegacy";

CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isMaster" BOOLEAN NOT NULL DEFAULT false,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#febe2e',
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");

CREATE TABLE "_TeamMembers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TeamMembers_AB_pkey" PRIMARY KEY ("A","B")
);

CREATE INDEX "_TeamMembers_B_index" ON "_TeamMembers"("B");

ALTER TABLE "_TeamMembers" ADD CONSTRAINT "_TeamMembers_A_fkey"
    FOREIGN KEY ("A") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_TeamMembers" ADD CONSTRAINT "_TeamMembers_B_fkey"
    FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The three roles the app shipped with, carrying the permissions that used to
-- be written into the source as isAdmin/isStaff checks.
INSERT INTO "Role" ("id", "name", "description", "isMaster", "isDefault", "position", "permissions") VALUES
    ('role_admin', 'Admin', 'Owns the instance. Every permission, always.', true, false, 2, ARRAY[]::TEXT[]),
    ('role_operator', 'Operator', 'Works the queue and keeps profiles current.', false, false, 1, ARRAY[
        'ticket.view.all','ticket.edit','ticket.assign','ticket.requester','ticket.note','ticket.merge',
        'people.view','people.create','people.edit'
    ]),
    ('role_requester', 'Requester', 'Raises tickets and follows their own.', false, true, 0, ARRAY[]::TEXT[]);

ALTER TABLE "User" ADD COLUMN "roleId" TEXT;

UPDATE "User" SET "roleId" = CASE "role"
    WHEN 'ADMIN' THEN 'role_admin'
    WHEN 'AGENT' THEN 'role_operator'
    ELSE 'role_requester'
END;

ALTER TABLE "User" ALTER COLUMN "roleId" SET NOT NULL;

DROP INDEX "User_role_idx";
ALTER TABLE "User" DROP COLUMN "role";
DROP TYPE "RoleLegacy";

CREATE INDEX "User_roleId_idx" ON "User"("roleId");
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey"
    FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Ticket" ADD COLUMN "teamId" TEXT;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TYPE "ActivityType" ADD VALUE 'TEAM_CHANGED';
