-- Moving a ticket between projects is a change worth recording, like every
-- other property change on the ticket.
ALTER TYPE "ActivityType" ADD VALUE 'PROJECT_CHANGED';
