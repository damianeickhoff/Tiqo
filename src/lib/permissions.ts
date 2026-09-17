import type { SessionUser } from "@/lib/auth";

/**
 * What a role can be given.
 *
 * The catalogue is the contract: a key here is the only thing the app ever
 * checks, and the settings screen builds itself from this list — add a
 * permission here and it appears there, already grouped. What each one is
 * *called* lives in the dictionaries, so a permission reads in the language the
 * desk runs in.
 *
 * Two things are deliberately *not* permissions. Raising a ticket and reading
 * your own are what an account is for, so nobody can be denied them. And the
 * master role does not consult this list at all.
 */
export const PERMISSIONS = [
  { key: "desk.access", group: "desk" },
  { key: "ticket.view.all", group: "tickets" },
  { key: "ticket.edit", group: "tickets" },
  { key: "ticket.assign", group: "tickets" },
  { key: "ticket.requester", group: "tickets" },
  { key: "ticket.note", group: "tickets" },
  { key: "ticket.merge", group: "tickets" },
  { key: "approval.request", group: "tickets" },
  { key: "approval.give", group: "tickets" },
  { key: "ticket.delete", group: "tickets" },
  { key: "comment.moderate", group: "tickets" },
  { key: "activity.delete", group: "tickets" },
  { key: "people.view", group: "people" },
  { key: "people.create", group: "people" },
  { key: "people.edit", group: "people" },
  { key: "people.role", group: "people" },
  { key: "people.deactivate", group: "people" },
  { key: "team.manage", group: "teams" },
  { key: "ci.view", group: "cmdb" },
  { key: "ci.edit", group: "cmdb" },
  { key: "ci.manage", group: "cmdb" },
  { key: "doc.view", group: "docs" },
  { key: "doc.edit", group: "docs" },
  { key: "doc.manage", group: "docs" },
  { key: "project.manage", group: "settings" },
  { key: "settings.general", group: "settings" },
  { key: "settings.tickets", group: "settings" },
  { key: "settings.tags", group: "settings" },
  { key: "settings.words", group: "settings" },
  { key: "settings.mail", group: "settings" },
  { key: "settings.roles", group: "settings" },
] as const;

export type Permission = (typeof PERMISSIONS)[number]["key"];

export const PERMISSION_KEYS = PERMISSIONS.map((permission) => permission.key);

export const PERMISSION_GROUPS = [...new Set(PERMISSIONS.map((p) => p.group))];

/** Enough of a user to check anything here — a session, or a row loaded with
 *  its role. */
export type Actor = {
  id: string;
  isMaster: boolean;
  permissions: readonly string[];
};

/**
 * Whether this account may be on the desk at all.
 *
 * Separate from every other permission on purpose: a requester with an account
 * belongs on the portal, and "can see the queue" is a different question from
 * "can change a ticket". Everything under /(app) answers to this one line.
 */
export function canUseDesk(user: Actor) {
  return can(user, "desk.access");
}

/**
 * The one check. The master role short-circuits it: its permission list is
 * empty in the database precisely so that nothing can trim it.
 */
export function can(user: Actor, permission: Permission) {
  return user.isMaster || user.permissions.includes(permission);
}

/** Anyone who works the queue rather than only raising tickets. Used for the
 *  handful of places that need "is this person staff at all". */
export function isStaff(user: Actor) {
  return can(user, "ticket.view.all");
}

/* ---------------------------------------------------------------- tickets -- */

/** Without `ticket.view.all` a person sees only what they reported. */
export function ticketVisibilityFilter(user: SessionUser) {
  return can(user, "ticket.view.all") ? {} : { reporterId: user.id };
}

/**
 * Whether this person may read this ticket at all.
 *
 * Being named as the approver of a round is a view right, on the same footing
 * as having raised it: somebody asked this person to decide something about
 * this ticket, and a decision made without reading what it is about is not a
 * decision. The rounds are optional in the shape so the many callers that only
 * ask the first two questions do not have to select them — a caller that does
 * not load them is simply not answering the third question.
 */
export function canViewTicket(
  user: Actor,
  ticket: {
    reporterId: string;
    assigneeId: string | null;
    approvals?: { approverId: string | null }[];
  },
) {
  return (
    can(user, "ticket.view.all") ||
    ticket.reporterId === user.id ||
    Boolean(ticket.approvals?.some((round) => round.approverId === user.id))
  );
}

export function canEditTicket(user: SessionUser) {
  return can(user, "ticket.edit");
}

export function canComment(user: Actor, ticket: { reporterId: string; assigneeId: string | null }) {
  return canViewTicket(user, ticket);
}

export function canWriteInternalNote(user: SessionUser) {
  return can(user, "ticket.note");
}

/**
 * Who may be *named* on a request for approval.
 *
 * Not the same question as who may answer one: answering is ungated on purpose,
 * because being asked is what gives somebody the right to answer and a
 * permission an admin can take away would strand a request already addressed to
 * them. This one only decides who the picker offers — which is what stops a
 * request being sent to somebody who has nowhere to answer it.
 */
export const APPROVER_ROLE_FILTER = {
  isActive: true,
  role: { OR: [{ isMaster: true }, { permissions: { has: "approval.give" } }] },
};

/**
 * Everyone owns what they wrote. Moderating someone else's words is its own
 * permission, held by whoever the desk trusts with the record.
 */
export function canEditComment(user: Actor, comment: { authorId: string }) {
  return comment.authorId === user.id || can(user, "comment.moderate");
}

export const canDeleteComment = canEditComment;

/* ----------------------------------------------------------------- people -- */

export function canViewDirectory(user: Actor) {
  return can(user, "people.view");
}

/**
 * How much of someone's profile the viewer may rewrite.
 *
 *   "all"     — every field, including the name and the organisation details.
 *   "contact" — only what a person is trusted to keep current about themselves:
 *               their email address and their phone number.
 *   "none"    — read-only.
 *
 * Nobody edits a master admin but a master admin: the role that cannot be
 * trimmed should not be reachable sideways through its account either.
 */
export function profileAccess(
  actor: Actor,
  target: { id: string; isMaster: boolean },
): "all" | "contact" | "none" {
  if (actor.isMaster) return "all";
  if (target.isMaster) return actor.id === target.id ? "contact" : "none";
  if (can(actor, "people.edit")) return "all";
  return actor.id === target.id ? "contact" : "none";
}

/**
 * Changing a role, deactivating and deleting all follow the same three rules:
 * you need the permission, you can never do it to yourself, and you can never
 * do it to a master admin unless you are one.
 *
 * The self-rule is not paranoia about mistakes — it is what stops the last
 * admin demoting themselves and leaving the instance with no way back in.
 */
function canActOn(actor: Actor, target: { id: string; isMaster: boolean }, permission: Permission) {
  if (actor.id === target.id) return false;
  if (target.isMaster && !actor.isMaster) return false;
  return can(actor, permission);
}

export function canChangeRole(actor: Actor, target: { id: string; isMaster: boolean }) {
  return canActOn(actor, target, "people.role");
}

export function canDeactivate(actor: Actor, target: { id: string; isMaster: boolean }) {
  return canActOn(actor, target, "people.deactivate");
}

export function canCreatePeople(user: Actor) {
  return can(user, "people.create");
}

/* --------------------------------------------------------------- settings -- */

export function canManageProjects(user: Actor) {
  return can(user, "project.manage");
}

/** Anything in the settings area at all — the gate on the section itself. */
export const SETTINGS_PERMISSIONS = [
  "settings.general",
  "settings.tickets",
  "settings.tags",
  "settings.words",
  "settings.mail",
  "settings.roles",
  "team.manage",
  "doc.manage",
] as const satisfies readonly Permission[];

export function canOpenSettings(user: Actor) {
  return SETTINGS_PERMISSIONS.some((permission) => can(user, permission));
}

/* ------------------------------------------------------------------ cmdb -- */

/** The register is readable by anyone the desk has given `ci.view`; without it
 *  the section is not in the navigation at all. */
export function canViewCis(user: Actor) {
  return can(user, "ci.view");
}

/** Editing an item is not the same as defining what an item *is*: one is a day's
 *  work on the desk, the other changes the shape of every item of that type. */
export function canEditCis(user: Actor) {
  return can(user, "ci.edit");
}

export function canManageCis(user: Actor) {
  return can(user, "ci.manage");
}

/* ------------------------------------------------------------------ docs -- */

/**
 * Three permissions and the same shape as the register, because the line falls
 * in the same place: reading is a section on the rail, writing is a day's work,
 * and managing decides what shelves exist at all.
 *
 * The space's team is not a fourth check. A document is written for the desk to
 * read and a runbook nobody can find is a runbook nobody follows, so the team
 * on a space says who *answers* for it, not who may open it.
 */
export function canViewDocs(user: Actor) {
  return can(user, "doc.view");
}

export function canEditDocs(user: Actor) {
  return can(user, "doc.edit");
}

/** Spaces, archiving, and putting a document on the portal. */
export function canManageDocs(user: Actor) {
  return can(user, "doc.manage");
}
