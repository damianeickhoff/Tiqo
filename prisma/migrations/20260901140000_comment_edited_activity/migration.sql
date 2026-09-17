-- Editing a comment changes what the ticket says, so it belongs in the trail.
ALTER TYPE "ActivityType" ADD VALUE 'COMMENT_EDITED';
