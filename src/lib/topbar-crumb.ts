/**
 * What the top bar says you are looking at.
 *
 * This used to be a portal into a slot the bar renders, which only worked on a
 * full page load: on a client-side navigation the page renders before the bar
 * has committed the branch containing that slot, so `getElementById` came back
 * empty and nothing ever asked again. A store has no such ordering problem —
 * the page writes, the bar subscribes, and whoever renders second still sees it.
 */
export type Crumb = { reference: string; title: string } | null;

let crumb: Crumb = null;
const listeners = new Set<() => void>();

export function setCrumb(next: Crumb) {
  crumb = next;
  for (const listener of listeners) listener();
}

export function subscribeCrumb(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getCrumb() {
  return crumb;
}

/** The server has no ticket in hand when it renders the bar. */
export function getServerCrumb(): Crumb {
  return null;
}
