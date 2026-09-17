-- Using the desk is now a permission of its own, so an account can hold a role
-- without being let into the queue at all.
--
-- Every role that could already see every ticket was, by definition, a role
-- that worked the desk — so it keeps that access. Roles that could only see
-- their own tickets (a requester) are left without it, which is the whole
-- point of splitting it out.
UPDATE "Role"
SET permissions = array_append(permissions, 'desk.access')
WHERE 'ticket.view.all' = ANY (permissions)
  AND NOT ('desk.access' = ANY (permissions));
