"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FileText,
  MoreHorizontal,
  Plus,
  Search,
} from "lucide-react";
import { createDoc, moveDoc } from "@/lib/actions/docs";
import { buildTree, docHref, type TreeNode } from "@/lib/docs";
import { StaleDot } from "@/components/docs/review-chip";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

export type TreeDoc = {
  id: string;
  slug: string;
  title: string;
  /// Searched alongside the title. A runbook is often remembered by what it is
  /// about rather than by what it was called, and the summary is the sentence
  /// that says that.
  summary: string | null;
  parentId: string | null;
  position: number;
  archivedAt: Date | null;
  /// Worked out on the server, because staleness is a question about now.
  reviewIn: number | null;
};

/**
 * The shelf, as a tree.
 *
 * Every page under the space in one list rather than a query per level: a rail
 * of thirty documents should cost one round trip, and the nesting is three
 * columns of data that the browser can fold for itself.
 *
 * Open by default, all the way down. A collapsed tree hides exactly the thing
 * somebody came to the rail to find, and a runbook's sub-pages are the steps of
 * the runbook — the branch is the content.
 */
export function DocTree({
  spaceId,
  spaceKey,
  docs,
  canEdit,
}: {
  spaceId: string;
  spaceKey: string;
  docs: TreeDoc[];
  canEdit: boolean;
}) {
  const t = useMessages();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [closed, setClosed] = useState<Set<string>>(new Set());
  // Below the breakpoint the rail is not beside the page, it is stacked on top
  // of it — so on a phone the whole shelf stood between somebody and the
  // runbook they opened. It folds there, and only there: at rail width it is
  // the navigation and hiding it would be hiding the point of the column.
  const [shown, setShown] = useState(false);

  const needle = query.trim().toLowerCase();

  // Filtering flattens: a match three levels down is useless behind two parents
  // that do not match, and re-rooting the tree around hits is a puzzle nobody
  // asked for. So searching turns the rail into a plain list of what matched.
  const matches = useMemo(
    () =>
      needle
        ? docs.filter((doc) => `${doc.title} ${doc.summary ?? ""}`.toLowerCase().includes(needle))
        : [],
    [docs, needle],
  );

  const roots = useMemo(() => buildTree(docs), [docs]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <button
        type="button"
        onClick={() => setShown((was) => !was)}
        aria-expanded={shown}
        className="text-text-2 hover:text-text -mx-1 flex items-center gap-1.5 rounded px-1 py-1 text-base font-medium transition-colors lg:hidden"
      >
        {shown ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {t.docs.browseShelf}
        <span className="text-text-3 text-sm">{docs.length}</span>
      </button>

      <div className={cn("min-h-0 flex-1 flex-col gap-2", shown ? "flex" : "hidden lg:flex")}>
        <div className="relative">
          <Search
            size={13}
            aria-hidden
            className="text-text-3 pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.docs.findInSpace}
            aria-label={t.docs.findInSpace}
            className="bg-surface placeholder:text-text-3 focus:border-brand rounded-control h-8 w-full border border-transparent pr-2.5 pl-7.5 text-base shadow-[var(--highlight)] transition-[border-color,box-shadow] focus:ring-[3px] focus:ring-[var(--brand-tint)] focus:outline-none"
          />
        </div>

        <nav className="rail-scroll min-h-0 flex-1 overflow-y-auto pb-2">
          {needle ? (
            matches.length === 0 ? (
              <p className="text-text-3 px-2 py-3 text-sm">{t.docs.noMatches}</p>
            ) : (
              <ul>
                {matches.map((doc) => (
                  <Row
                    key={doc.id}
                    doc={doc}
                    depth={0}
                    spaceKey={spaceKey}
                    active={pathname === docHref(spaceKey, doc.slug)}
                  />
                ))}
              </ul>
            )
          ) : roots.length === 0 ? (
            <p className="text-text-3 px-2 py-3 text-sm">{t.docs.emptyBody}</p>
          ) : (
            <Branch
              nodes={roots}
              spaceId={spaceId}
              spaceKey={spaceKey}
              canEdit={canEdit}
              pathname={pathname}
              closed={closed}
              toggle={(id) =>
                setClosed((current) => {
                  const next = new Set(current);
                  if (!next.delete(id)) next.add(id);
                  return next;
                })
              }
            />
          )}
        </nav>

        {canEdit && !needle ? <AddPage spaceId={spaceId} parentId={null} full /> : null}
      </div>
    </div>
  );
}

function Branch({
  nodes,
  spaceId,
  spaceKey,
  canEdit,
  pathname,
  closed,
  toggle,
}: {
  nodes: TreeNode<TreeDoc>[];
  spaceId: string;
  spaceKey: string;
  canEdit: boolean;
  pathname: string;
  closed: Set<string>;
  toggle: (id: string) => void;
}) {
  return (
    <ul>
      {nodes.map((node) => {
        const open = !closed.has(node.id);
        return (
          <li key={node.id}>
            <Row
              doc={node}
              depth={node.depth}
              spaceKey={spaceKey}
              active={pathname === docHref(spaceKey, node.slug)}
              hasChildren={node.children.length > 0}
              open={open}
              onToggle={() => toggle(node.id)}
              canEdit={canEdit}
              spaceId={spaceId}
            />
            {node.children.length > 0 && open ? (
              <Branch
                nodes={node.children}
                spaceId={spaceId}
                spaceKey={spaceKey}
                canEdit={canEdit}
                pathname={pathname}
                closed={closed}
                toggle={toggle}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * One page on the rail.
 *
 * Move, move and add a page under this one live behind a single button rather
 * than as three that appear on hover. A rail carrying three controls per row is
 * a rail nobody can read the titles in — and hover is not something a phone
 * has, so on touch those three controls were not there at all.
 */
function Row({
  doc,
  depth,
  spaceKey,
  active,
  hasChildren = false,
  open = true,
  onToggle,
  canEdit = false,
  spaceId,
}: {
  doc: TreeDoc;
  depth: number;
  spaceKey: string;
  active: boolean;
  hasChildren?: boolean;
  open?: boolean;
  onToggle?: () => void;
  canEdit?: boolean;
  spaceId?: string;
}) {
  const t = useMessages();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    // A wrapper rather than the row itself, so the field for a new page can sit
    // under the row instead of floating over the two below it. An overlay in a
    // list is a control that hides the thing it is about to be filed beside.
    <div
      className={cn(
        "group rounded-control transition-colors",
        active ? "bg-surface-3" : "hover:bg-surface-2",
        pending && "opacity-50",
      )}
      // Four levels of indent and then it stops: past that the titles are in a
      // column two characters wide, and the nesting has stopped being legible
      // anyway.
      style={{ paddingLeft: `${Math.min(depth, 4) * 12}px` }}
    >
      <div className="flex items-center gap-1 pr-1">
        {hasChildren ? (
          <button
            type="button"
            onClick={onToggle}
            // What the button does, not what it is next to: a screen reader
            // announcing the page title on a control that folds the branch says
            // nothing about folding the branch.
            aria-label={open ? t.docs.collapse(doc.title) : t.docs.expand(doc.title)}
            aria-expanded={open}
            className="text-text-3 hover:text-text flex size-5 shrink-0 items-center justify-center"
          >
            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        ) : (
          <span className="size-5 shrink-0" aria-hidden />
        )}

        <Link
          href={docHref(spaceKey, doc.slug)}
          aria-current={active ? "page" : undefined}
          className={cn(
            "min-w-0 flex-1 truncate py-1.5 text-base transition-colors",
            active ? "text-text font-semibold" : "text-text-2 hover:text-text",
            doc.archivedAt && "line-through opacity-60",
          )}
        >
          {doc.title}
        </Link>

        <StaleDot days={doc.reviewIn} />

        {canEdit && spaceId ? (
          <RowMenu
            title={doc.title}
            pending={pending}
            onMove={(direction) =>
              startTransition(async () => {
                const result = await moveDoc(doc.id, direction);
                // Reordering is a list-level command and happens at once, which
                // is exactly why a refusal has to be said: a row that simply did
                // not move reads as a broken button.
                setError(result.ok ? null : (result.error ?? t.errors.generic));
              })
            }
            onAdd={() => setAdding(true)}
          />
        ) : null}
      </div>

      {adding && spaceId ? (
        <AddPage spaceId={spaceId} parentId={doc.id} onDone={() => setAdding(false)} />
      ) : null}

      {error ? <p className="text-negative px-2 pb-1 text-xs">{error}</p> : null}
    </div>
  );
}

/**
 * The three things that can be done to a row, behind one button.
 *
 * Dimmed rather than hidden until the row is hovered or focused, so it is
 * present on a touch screen — which is the whole difference between a control
 * and a control some people have.
 */
function RowMenu({
  title,
  pending,
  onMove,
  onAdd,
}: {
  title: string;
  pending: boolean;
  onMove: (direction: "up" | "down") => void;
  onAdd: () => void;
}) {
  const t = useMessages();
  const [open, setOpen] = useState(false);

  return (
    <span className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        disabled={pending}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t.common.more}
        title={t.common.more}
        className={cn(
          "text-text-3 hover:bg-surface-3 hover:text-text flex size-5 items-center justify-center rounded transition-[background-color,color,opacity]",
          open
            ? "opacity-100"
            : "opacity-40 group-focus-within:opacity-100 group-hover:opacity-100",
        )}
      >
        <MoreHorizontal size={13} />
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <span
            role="menu"
            className="animate-rise bg-surface rounded-card absolute right-0 z-50 mt-1 flex w-52 flex-col overflow-hidden p-1 shadow-[var(--shadow-float)]"
          >
            <MenuItem
              icon={<ChevronUp size={13} className="text-text-3" />}
              label={t.common.moveUp(title)}
              onClick={() => {
                setOpen(false);
                onMove("up");
              }}
            />
            <MenuItem
              icon={<ChevronDown size={13} className="text-text-3" />}
              label={t.common.moveDown(title)}
              onClick={() => {
                setOpen(false);
                onMove("down");
              }}
            />
            <MenuItem
              icon={<Plus size={13} className="text-text-3" />}
              label={t.docs.addChild}
              onClick={() => {
                setOpen(false);
                onAdd();
              }}
            />
          </span>
        </>
      ) : null}
    </span>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="text-text-2 hover:bg-surface-2 hover:text-text rounded-control flex items-center gap-2 px-2 py-1.5 text-left text-base transition-colors"
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}

/**
 * A new page, named on the rail where it will appear.
 *
 * Adding is a list-level command and takes effect at once — but a page still
 * needs a name before it is one, so the row becomes a field rather than opening
 * a dialog to ask for a single word.
 */
export function AddPage({
  spaceId,
  parentId,
  full = false,
  onDone,
}: {
  spaceId: string;
  parentId: string | null;
  full?: boolean;
  /// Given by a row, which owns whether the field is showing. The whole-shelf
  /// button at the foot of the rail owns its own.
  onDone?: () => void;
}) {
  const t = useMessages();
  const [open, setOpen] = useState(!full);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function create() {
    const clean = title.trim();
    if (!clean) return;

    startTransition(async () => {
      const result = await createDoc({ spaceId, parentId, title: clean });
      if (!result.ok) {
        setError(result.error ?? t.errors.generic);
        return;
      }
      setTitle("");
      setOpen(false);
      onDone?.();
      setError(null);
      // A full navigation rather than a push: the page that was just made is
      // the one somebody wants to be standing on.
      window.location.assign(result.href);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-line text-text-2 hover:border-line-strong hover:text-text rounded-control flex h-8 w-full items-center justify-center gap-1.5 border border-dashed text-base font-medium transition-colors"
      >
        <Plus size={13} />
        {t.docs.newDoc}
      </button>
    );
  }

  return (
    <div className={cn("py-1", full ? "w-full" : "px-1 pb-1")}>
      <div className="bg-surface rounded-control flex items-center gap-1 border border-transparent px-1.5 shadow-[var(--shadow-sm)]">
        <FileText size={12} className="text-text-3 shrink-0" />
        <input
          autoFocus
          value={title}
          maxLength={160}
          placeholder={t.docs.docTitle}
          aria-label={t.docs.docTitle}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") create();
            if (event.key === "Escape") {
              setOpen(false);
              setTitle("");
              onDone?.();
            }
          }}
          onBlur={() => {
            if (pending || title.trim()) return;
            setOpen(false);
            onDone?.();
          }}
          className="h-7 min-w-0 flex-1 bg-transparent text-base outline-none"
        />
        <button
          type="button"
          onClick={create}
          disabled={pending || !title.trim()}
          className="text-brand-deep shrink-0 px-1 text-sm font-semibold disabled:opacity-40"
        >
          {pending ? t.common.adding : t.common.add}
        </button>
      </div>
      {error ? <p className="text-negative mt-1 px-1 text-xs">{error}</p> : null}
    </div>
  );
}
