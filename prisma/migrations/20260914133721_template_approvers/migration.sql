-- AlterTable
ALTER TABLE "ChangeTemplate" ADD COLUMN     "approverId" TEXT;

-- AlterTable
ALTER TABLE "ChangeTemplatePhase" ADD COLUMN     "approverId" TEXT;

-- AddForeignKey
ALTER TABLE "ChangeTemplate" ADD CONSTRAINT "ChangeTemplate_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeTemplatePhase" ADD CONSTRAINT "ChangeTemplatePhase_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
