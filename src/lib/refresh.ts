import "server-only";

import { revalidatePath } from "next/cache";

/**
 * A ticket changed.
 *
 * Two halves of the app show the same ticket — the desk and the portal of the
 * person who raised it — and an action that revalidates only the half it was
 * invoked from leaves the other one stale. That is what left a requester
 * looking at "Open" for a request the desk had already moved to waiting.
 *
 * Cheap enough to call on every write: these are page revalidations, not
 * queries, and the alternative is remembering which changes are visible from
 * which side.
 */
/**
 * A decision was asked, answered or withdrawn.
 *
 * The portal keeps its own list of what is waiting on you and a count beside
 * the link to it, and neither hangs off a ticket path — an approver is often
 * not the requester, so `refreshTicket` never touches the pages they are looking
 * at. The layout is revalidated rather than the page because the count lives
 * in the header.
 */
export function refreshApprovals() {
  revalidatePath("/portal/approvals");
  revalidatePath("/portal", "layout");
}

export function refreshTicket(number: number) {
  revalidatePath(`/tickets/${number}`);
  revalidatePath("/tickets");
  revalidatePath(`/portal/requests/${number}`);
  revalidatePath("/portal/requests");
  revalidatePath("/portal");
  revalidatePath("/");
}
