/**
 * The shape of a notice, kept out of the actions file because a `"use server"`
 * module may only export async functions — and both the bell and the shell need
 * this type without importing the server behind it.
 */
export type Notice = {
  id: string;
  kind:
    | "ASSIGNED"
    | "FORWARDED"
    | "COMMENTED"
    | "MENTIONED"
    | "APPROVAL_REQUESTED"
    | "APPROVAL_DECIDED"
    | "RAISED"
    | "BLOCKED"
    | "DOC_EDITED"
    | "DOC_STALE";
  readAt: Date | null;
  createdAt: Date;
  actor: { name: string; avatarVariant: number } | null;
  /// One of the two is set. A mention written in a project's conversation has
  /// no ticket to point at, so the notice points at the project instead.
  ticket: { number: number; reference: string; title: string } | null;
  project: { key: string; name: string } | null;
  /// The third: a page somebody answers for. Its space key stands where a
  /// reference would, because that is how a document is addressed.
  doc: { slug: string; title: string; space: { key: string } } | null;
};

/** The bell only ever shows the last handful; the rest is history nobody scrolls. */
export const NOTICE_LIMIT = 8;
