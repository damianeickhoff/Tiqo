-- Reading and writing the desk's own documentation is ordinary desk work, so
-- every role that already works the desk gets both. The permissions exist so
-- that access can be taken away from a role that should not have it — not so
-- that every operator has to be granted the runbooks one at a time.
--
-- `doc.manage` is deliberately not granted: what shelves exist, what is
-- archived, and what is put in front of requesters on the portal are decisions
-- for whoever runs the instance.
UPDATE "Role"
SET permissions = permissions || ARRAY['doc.view', 'doc.edit']
WHERE 'desk.access' = ANY (permissions)
  AND NOT ('doc.view' = ANY (permissions));
