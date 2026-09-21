import type { Messages } from "@/lib/i18n";

/**
 * The four questions the list of projects is asked, as one click each.
 *
 * The same shape as the queue's views: a view sets the parameters it names and
 * nothing else is on, which is what makes "am I in this view" a question about
 * the whole address rather than about the keys the view happens to mention.
 * They were a segmented control above the table until the views column gave
 * them a permanent home.
 *
 * Active is the empty address, because landing on `/projects` is landing in it.
 * The three that follow narrow it; archived projects are somewhere you go
 * rather than something you happen to still be showing.
 */
export const PROJECT_VIEWS = [
  { id: "active", params: {} },
  { id: "lead", params: { lead: "me" } },
  { id: "offTrack", params: { health: "OFF_TRACK" } },
  { id: "archived", params: { archived: "1" } },
] as const;

export type ProjectView = (typeof PROJECT_VIEWS)[number];

export type ProjectViewCounts = Record<ProjectView["id"], number>;

/** Everything that narrows the list, so a view is only current when nothing
 *  else is set. */
export const PROJECT_KEYS = ["archived", "lead", "health", "q"] as const;

/** Which view the address is standing in, if any. The page head says its name,
 *  and the column draws them all. */
export function matchProjectView(params: URLSearchParams) {
  const on = PROJECT_KEYS.filter((key) => params.get(key));
  return PROJECT_VIEWS.find((view) => {
    const keys = Object.keys(view.params);
    return (
      on.length === keys.length &&
      keys.every((key) => params.get(key) === view.params[key as keyof typeof view.params])
    );
  });
}

/** What a view is called. Three of them already had a name on this page; only
 *  "Led by me" is a new word, and an address that stands in none of them is
 *  simply filtered. */
export function projectViewLabel(view: ProjectView | undefined, t: Messages) {
  switch (view?.id) {
    case "active":
      return t.projects.filterActive;
    case "lead":
      return t.projects.viewLedByMe;
    case "offTrack":
      return t.projects.healthNames.OFF_TRACK;
    case "archived":
      return t.projects.archived;
    default:
      return t.projects.viewFiltered;
  }
}
