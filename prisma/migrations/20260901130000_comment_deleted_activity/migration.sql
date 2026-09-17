-- Deleting a comment is a change to the ticket, so it belongs in the trail.
ALTER TYPE "ActivityType" ADD VALUE 'COMMENT_DELETED';
