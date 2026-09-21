"use client";

import { useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { Flag, Inbox, Layers, Star, UserRound, Users, X } from "lucide-react";
import { ViewsColumn, type ViewGroup } from "@/components/shell/views-column";
import { Input } from "@/components/ui";
import { useMessages } from "@/components/shell/instance-context";

/**
 * The five questions an operator starts from, as one click each.
 *
 * A view sets several parameters at once and replaces whatever was there, which
 * is the point: "unassigned" means unassigned, not "unassigned as well as the
 * three filters I forgot were on". They were a segmented control above the
 * table until the views column gave them a permanent home.
 */
const VIEWS = [
  { id: "open", label: "viewAllOpen", count: "open", params: { open: "1" } },
  { id: "mine", label: "viewMine", count: "mine", params: { open: "1", assignee: "me" } },
  { id: "groups", label: "viewMyGroups", count: "groups", params: { open: "1", scope: "team" } },
  {
    id: "unassigned",
    label: "viewUnassigned",
    count: "unassigned",
    params: { open: "1", assignee: "none" },
  },
  { id: "all", label: "viewEverything", count: "all", params: {} },
] as const;

const ICON = {
  open: Inbox,
  mine: UserRound,
  groups: Users,
  unassigned: Flag,
  all: Layers,
} as const;

export type ViewCounts = Record<(typeof VIEWS)[number]["count"], number>;

/** Everything that narrows the queue, so "am I in this view" is a question
 *  about all of it rather than about the keys the view happens to name. */
const KEYS = [
  "status",
  "priority",
  "project",
  "milestone",
  "assignee",
  "type",
  "team",
  "approval",
  "scope",
  "open",
  "blocked",
  "q",
] as const;

/** A view somebody kept: what they called it, and what it was showing. */
type SavedView = { name: string; query: string };

/**
 * Where the kept views live.
 *
 * The browser, for now: the register keeps its views on the account, and the
 * queue has no column to put them in yet — a migration is a decision of its
 * own. The shape is the register's, so moving them to the account later is a
 * change of store and not of meaning.
 */
const STORE = "tiqo.queue.views";
const LIMIT = 20;
const MAX_NAME = 40;

const NONE: SavedView[] = [];

/**
 * What is stored, read defensively.
 *
 * It is text somebody could have written anything into, and a queue that will
 * not draw because a kept view is malformed is worse than a view that quietly
 * is not there.
 */
function parse(raw: string): SavedView[] {
  try {
    const rows = JSON.parse(raw) as unknown;
    if (!Array.isArray(rows)) return NONE;
    const views: SavedView[] = [];
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const { name, query } = row as Record<string, unknown>;
      if (typeof name !== "string" || typeof query !== "string") continue;
      const trimmed = name.trim().slice(0, MAX_NAME);
      if (!trimmed || views.some((view) => view.name === trimmed)) continue;
      views.push({ name: trimmed, query });
    }
    return views.slice(0, LIMIT);
  } catch {
    return NONE;
  }
}

/** The last text read and what it parsed to, so a snapshot is the same list
 *  until the text itself changes — a new array every render would be a render
 *  every render. */
let cache = { raw: "", views: NONE };
const listeners = new Set<() => void>();

function announce() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab of the same queue keeps the same views.
  window.addEventListener("storage", announce);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", announce);
  };
}

function snapshot(): SavedView[] {
  let raw = "";
  try {
    raw = window.localStorage.getItem(STORE) ?? "";
  } catch {
    return NONE;
  }
  if (raw !== cache.raw) cache = { raw, views: parse(raw) };
  return cache.views;
}

/** The server has no browser storage, so it draws no kept views — and the
 *  first client render agrees with the HTML it replaces. */
const empty = () => NONE;

function writeStore(views: SavedView[]) {
  try {
    window.localStorage.setItem(STORE, JSON.stringify(views));
  } catch {
    /* A browser that will not keep them is not a queue that cannot be read. */
  }
  announce();
}

/**
 * The queue's views column: the five built-in views with live counts, then
 * whatever this browser has kept, then the row that keeps one more.
 */
export function QueueViews({ counts }: { counts: ViewCounts }) {
  const t = useMessages();
  const params = useSearchParams();
  const saved = useSyncExternalStore(subscribe, snapshot, empty);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  // A view is current when the URL says exactly what the view says — no more.
  const current = matchView(new URLSearchParams(params.toString()));

  /** What is being looked at, not where in it: the page somebody was on is not
   *  part of the question they are keeping. */
  const query = (() => {
    const kept = new URLSearchParams(params.toString());
    kept.delete("page");
    return kept.toString();
  })();

  function save() {
    const wanted = name.trim().slice(0, MAX_NAME);
    if (!wanted) return;
    const next = [...saved.filter((view) => view.name !== wanted), { name: wanted, query }].slice(
      -LIMIT,
    );
    writeStore(next);
    setName("");
    setNaming(false);
  }

  function forget(view: SavedView) {
    writeStore(saved.filter((kept) => kept.name !== view.name));
  }

  const groups: ViewGroup[] = [
    {
      id: "built-in",
      heading: t.tickets.views,
      items: VIEWS.map((view) => {
        const Icon = ICON[view.id];
        return {
          id: view.id,
          label: t.tickets[view.label],
          icon: <Icon size={14} strokeWidth={2} />,
          count: counts[view.count],
          href: `/tickets?${new URLSearchParams(view.params).toString()}`,
          active: current?.id === view.id,
        };
      }),
    },
  ];

  if (saved.length) {
    groups.push({
      id: "saved",
      heading: t.tickets.savedViews,
      items: saved.map((view) => ({
        id: view.name,
        label: view.name,
        icon: <Star size={14} strokeWidth={2} />,
        href: `/tickets?${view.query}`,
        active: !current && view.query === query,
        action: (
          <button
            type="button"
            onClick={() => forget(view)}
            aria-label={t.tickets.forgetView(view.name)}
            title={t.tickets.forgetView(view.name)}
            className="text-text-3 hover:text-negative rounded-full p-1 transition-colors"
          >
            <X size={12} strokeWidth={2.5} />
          </button>
        ),
      })),
    });
  }

  return (
    <ViewsColumn
      label={t.tickets.views}
      groups={groups}
      save={naming ? undefined : { label: t.tickets.saveView, onSelect: () => setNaming(true) }}
    >
      {naming ? (
        <form
          className="mt-1 flex items-center gap-1 max-lg:shrink-0 lg:px-1"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <Input
            autoFocus
            value={name}
            maxLength={MAX_NAME}
            placeholder={t.tickets.viewName}
            aria-label={t.tickets.viewName}
            className="h-8 text-sm"
            onChange={(event) => setName(event.target.value)}
          />
          <button
            type="button"
            onClick={() => {
              setNaming(false);
              setName("");
            }}
            aria-label={t.common.cancel}
            className="text-text-3 hover:text-text rounded-control shrink-0 p-1 transition-colors"
          >
            <X size={14} />
          </button>
        </form>
      ) : null}
    </ViewsColumn>
  );
}

/** Which built-in view the address is standing in, if any. The page head says
 *  the view's name, and the views are described here. */
export function matchView(params: URLSearchParams) {
  const on = KEYS.filter((key) => params.get(key));
  return VIEWS.find((view) => {
    const keys = Object.keys(view.params);
    return (
      on.length === keys.length &&
      keys.every((key) => params.get(key) === view.params[key as keyof typeof view.params])
    );
  });
}
