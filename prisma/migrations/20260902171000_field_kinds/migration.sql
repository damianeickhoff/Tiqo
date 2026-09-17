-- A form builder needs more than five shapes of answer.
ALTER TYPE "PortalFieldKind" ADD VALUE IF NOT EXISTS 'RADIO';
ALTER TYPE "PortalFieldKind" ADD VALUE IF NOT EXISTS 'NUMBER';
ALTER TYPE "PortalFieldKind" ADD VALUE IF NOT EXISTS 'EMAIL';
ALTER TYPE "PortalFieldKind" ADD VALUE IF NOT EXISTS 'PHONE';
