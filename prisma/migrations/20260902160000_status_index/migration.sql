-- The project/status pair index follows the column that replaced the enum.
DROP INDEX IF EXISTS "Ticket_projectId_status_idx";
CREATE INDEX "Ticket_projectId_statusId_idx" ON "Ticket"("projectId", "statusId");
