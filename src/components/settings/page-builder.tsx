"use client";

import { useRef, useState, useTransition } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  GripVertical,
  Inbox,
  Lock,
  Megaphone,
  Plus,
  Search,
  Settings2,
  SquareStack,
  Star,
  Text,
  Trash2,
} from "lucide-react";
import type { PortalBlockKind } from "@/generated/prisma/enums";
import {
  addBlock,
  deleteBlock,
  moveBlock,
  reorderBlocks,
  updateBlock,
} from "@/lib/actions/portal-admin";
import { Button, Card, Input, Select, Textarea } from "@/components/ui";
import { SaveBar, useDraft } from "@/components/settings/draft";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

const BLOCK_ICONS: Record<PortalBlockKind, typeof Search> = {
  HERO: Search,
  ANNOUNCEMENTS: Megaphone,
  CATEGORIES: SquareStack,
  FEATURED_FORMS: Star,
  ARTICLES: BookOpen,
  MY_REQUESTS: Inbox,
  RICH_TEXT: Text,
};

// The hero is the portal's front door and is the same on every desk, so it is
// not something to add, move or rewrite — only the bands under it are.
const KINDS = (Object.keys(BLOCK_ICONS) as PortalBlockKind[]).filter((kind) => kind !== "HERO");

/** The front page is six columns wide; a band takes between two and all six. */
const COLUMNS = 6;
const MIN_SPAN = 2;

/**
 * Tailwind needs the class in the source to emit it, so the spans are a table
 * rather than a template string.
 */
const SPAN_CLASS: Record<number, string> = {
  2: "col-span-2",
  3: "col-span-3",
  4: "col-span-4",
  5: "col-span-5",
  6: "col-span-6",
};

export type Block = {
  id: string;
  kind: PortalBlockKind;
  title: string | null;
  subtitle: string | null;
  limit: number | null;
  categoryId: string | null;
  isActive: boolean;
  span: number;
};

/**
 * The front page, laid out rather than listed.
 *
 * A list with move buttons could say the order but never the shape, so nobody
 * could tell what the page would look like without publishing it and going to
 * look. This is the page: bands sit at the width they will have, are dragged
 * into the order they will be in, and are resized by pulling their edge. The
 * Preview tab is the real portal in a frame beside it, because a schematic is
 * still a drawing of a page and not the page.
 */
export function PageBuilder({
  blocks,
  categories,
  portalStatuses,
}: {
  blocks: Block[];
  categories: { id: string; name: string }[];
  /// How many statuses are set to show on the portal. A desk that has marked
  /// one but has no band to put them in would see the setting do nothing.
  portalStatuses: number;
}) {
  const t = useMessages();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  // The server's order, held locally so a drag can be shown at once and the
  // write can happen behind it. Reset during render rather than in an effect
  // when the server sends a new list, so the page never paints the stale one.
  const [order, setOrder] = useState(blocks);
  const [known, setKnown] = useState(blocks);
  if (known !== blocks) {
    setKnown(blocks);
    setOrder(blocks);
  }

  // Which band is in the hand. Held in a ref as well as in state: the state is
  // what dims the card, the ref is what the drop reads — a drop handler closes
  // over the render it was created in, and that render may not have seen the
  // drag start yet.
  const held = useRef<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  function run(work: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await work();
      setError(result.ok ? null : (result.error ?? t.errors.generic));
    });
  }

  /** Put the dragged band where it was dropped, then tell the server. */
  function drop(targetId: string) {
    const from = order.findIndex((row) => row.id === held.current);
    const to = order.findIndex((row) => row.id === targetId);
    held.current = null;
    setDragging(null);
    setOver(null);
    if (from < 0 || to < 0 || from === to) return;

    const next = [...order];
    next.splice(to, 0, next.splice(from, 1)[0]!);
    setOrder(next);
    run(() => reorderBlocks(next.map((row) => row.id)));
  }

  /** Width, while the edge is being dragged and once it is let go. */
  function resize(blockId: string, span: number, commit: boolean) {
    setOrder((was) => was.map((row) => (row.id === blockId ? { ...row, span } : row)));
    if (commit) run(() => updateBlock(blockId, { span }));
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="bg-negative/[0.06] text-negative rounded-control px-4 py-2 text-base font-medium">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {/* Two views of one thing: what it is made of, and what it looks
            like. Side by side would halve both on the screens this is used on. */}
        <div className="bg-surface-2 inline-flex items-center gap-0.5 rounded-full p-0.5">
          {[false, true].map((value) => (
            <button
              key={String(value)}
              type="button"
              onClick={() => setPreviewing(value)}
              aria-pressed={previewing === value}
              className={cn(
                "h-7 rounded-full px-3 text-sm font-medium transition-colors",
                previewing === value
                  ? "text-text bg-[var(--seg-on)] shadow-[0_1px_2px_rgba(9,9,11,0.1),0_0_0_1px_rgba(9,9,11,0.04)]"
                  : "text-text-2 hover:text-text",
              )}
            >
              {value ? t.forms.preview : t.forms.layout}
            </button>
          ))}
        </div>

        <p className="text-text-3 text-sm">
          {previewing ? t.forms.previewHint : t.forms.layoutHint}
        </p>
      </div>

      {previewing ? <Preview /> : null}

      <div className={cn(previewing && "hidden")}>
        {portalStatuses > 0 && order.length > 0 && !order.some((b) => b.kind === "MY_REQUESTS") ? (
          <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
            <p className="text-text-2 min-w-[16rem] flex-1 text-base">{t.forms.needRequestsBand}</p>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => run(() => addBlock("MY_REQUESTS"))}
            >
              <Plus size={15} strokeWidth={2.5} />
              {t.forms.blockNames.MY_REQUESTS}
            </Button>
          </Card>
        ) : null}

        {order.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-text-3 text-md">{t.forms.defaultLayout}</p>
          </Card>
        ) : (
          <ol className="grid grid-cols-6 gap-3">
            {order.map((block, index) => (
              <BlockCard
                key={block.id}
                block={block}
                categories={categories}
                first={index === 0}
                last={index === order.length - 1}
                pending={pending}
                dragging={dragging === block.id}
                over={over === block.id && dragging !== block.id}
                onDragStart={() => {
                  held.current = block.id;
                  setDragging(block.id);
                }}
                onDragEnd={() => {
                  held.current = null;
                  setDragging(null);
                  setOver(null);
                }}
                onDragOver={() => setOver(block.id)}
                onDrop={() => drop(block.id)}
                onResize={resize}
                run={run}
              />
            ))}
          </ol>
        )}

        {adding ? (
          <Card className="animate-rise mt-4 p-4">
            <p className="label mb-3">{t.forms.addBand}</p>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {KINDS.map((kind) => {
                const Icon = BLOCK_ICONS[kind];
                return (
                  <li key={kind}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        run(async () => {
                          const result = await addBlock(kind);
                          setAdding(false);
                          return result;
                        })
                      }
                      className="border-border hover:border-brand/45 rounded-card flex w-full items-start gap-2.5 border px-3 py-2.5 text-left transition-colors hover:bg-[var(--brand-tint)]"
                    >
                      <Icon size={16} className="text-text-3 mt-0.5 shrink-0" />
                      <span>
                        <span className="block text-base font-medium">
                          {t.forms.blockNames[kind]}
                        </span>
                        <span className="text-text-3 block text-sm leading-snug">
                          {t.forms.blockHints[kind]}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => setAdding(true)}
            className="mt-4 w-full"
          >
            <Plus size={15} strokeWidth={2.5} />
            {t.forms.addBand}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * The portal itself, in a frame.
 *
 * Same origin and the viewer's own session, so it shows exactly what they will
 * see — including whether a band came out empty, which is the one thing a
 * schematic can never tell you.
 */
function Preview() {
  const t = useMessages();
  return (
    <div className="border-line rounded-panel bg-bg overflow-hidden border">
      <iframe
        src="/portal"
        title={t.forms.preview}
        className="h-[70vh] w-full"
        // Nothing in the portal needs to reach out of the frame, and this is a
        // page an admin can fill with their own copy.
        sandbox="allow-same-origin allow-scripts"
      />
    </div>
  );
}

function BlockCard({
  block,
  categories,
  first,
  last,
  pending,
  dragging,
  over,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onResize,
  run,
}: {
  block: Block;
  categories: { id: string; name: string }[];
  first: boolean;
  last: boolean;
  pending: boolean;
  dragging: boolean;
  over: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  onResize: (blockId: string, span: number, commit: boolean) => void;
  run: (work: () => Promise<{ ok: boolean; error?: string }>) => void;
}) {
  const t = useMessages();
  const [open, setOpen] = useState(false);
  const item = useRef<HTMLLIElement>(null);

  const draft = useDraft({
    title: block.title ?? "",
    subtitle: block.subtitle ?? "",
    limit: block.limit ?? 6,
    categoryId: block.categoryId ?? "",
  });
  const { draft: form, set } = draft;

  const Icon = BLOCK_ICONS[block.kind];
  const locked = block.kind === "HERO";
  const configurable = block.kind !== "ANNOUNCEMENTS" && !locked;
  const countable = ["CATEGORIES", "FEATURED_FORMS", "ARTICLES", "MY_REQUESTS"].includes(
    block.kind,
  );
  const scopeable = ["CATEGORIES", "FEATURED_FORMS", "ARTICLES"].includes(block.kind);

  /**
   * Pulling the right edge.
   *
   * The width is worked out from the pointer's distance across the grid rather
   * than from how far it has moved, so a slow drag and a fast one land on the
   * same column. Pointer capture keeps the drag alive when the cursor leaves
   * the handle, which it does immediately.
   */
  function startResize(event: React.PointerEvent<HTMLButtonElement>) {
    if (locked) return;
    const grid = item.current?.parentElement;
    if (!grid) return;

    const box = grid.getBoundingClientRect();
    const left = item.current!.getBoundingClientRect().left;
    const column = box.width / COLUMNS;
    // Not every pointer can be captured; the window listeners below are what
    // actually keep the drag alive, so a refusal is not worth failing over.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {}

    const spanAt = (x: number) =>
      Math.min(COLUMNS, Math.max(MIN_SPAN, Math.round((x - left) / column)));

    const move = (moved: PointerEvent) => onResize(block.id, spanAt(moved.clientX), false);
    const up = (ended: PointerEvent) => {
      onResize(block.id, spanAt(ended.clientX), true);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <li
      ref={item}
      draggable={!locked}
      onDragStart={(event) => {
        // Firefox will not start a drag without something on the transfer.
        event.dataTransfer.setData("text/plain", block.id);
        event.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={(event) => {
        if (locked) return;
        event.preventDefault();
        onDragOver();
      }}
      onDrop={(event) => {
        if (locked) return;
        event.preventDefault();
        onDrop();
      }}
      className={cn(
        SPAN_CLASS[block.span] ?? SPAN_CLASS[6],
        "relative",
        dragging && "opacity-40",
        over && "ring-brand rounded-card ring-2",
      )}
    >
      <Card
        className={cn(
          "flex h-full flex-col overflow-hidden transition-[border-color]",
          !block.isActive && "opacity-60",
        )}
      >
        <div className="flex items-center gap-2 px-3 py-2.5">
          {locked ? (
            <span
              aria-hidden
              className="text-text-3 flex size-7 shrink-0 items-center justify-center"
            >
              <Lock size={14} />
            </span>
          ) : (
            <span
              aria-hidden
              className="text-text-3 flex size-7 shrink-0 cursor-grab items-center justify-center active:cursor-grabbing"
            >
              <GripVertical size={15} />
            </span>
          )}

          <span
            aria-hidden
            className="bg-surface-3 text-text-2 rounded-control flex size-8 shrink-0 items-center justify-center"
          >
            <Icon size={16} />
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-base font-semibold">
              {form.title || t.forms.blockNames[block.kind]}
            </span>
            <span className="text-text-3 block truncate text-xs">
              {/* The width in words, because the card is already at that width
                  and a number beside it would be the same thing twice. */}
              {block.span === COLUMNS ? t.forms.widthFull : t.forms.widthOf(block.span, COLUMNS)}
            </span>
          </span>

          {draft.dirty ? (
            <span className="bg-brand size-1.5 shrink-0 rounded-full" title={t.common.unsaved} />
          ) : null}

          {locked ? null : (
            <span className="flex shrink-0 items-center gap-0.5">
              {configurable ? (
                <button
                  type="button"
                  onClick={() => setOpen((current) => !current)}
                  aria-expanded={open}
                  aria-label={t.common.editThing(t.forms.blockNames[block.kind])}
                  className="text-text-3 hover:bg-surface-3 hover:text-text rounded-control flex size-7 items-center justify-center"
                >
                  <Settings2 size={14} />
                </button>
              ) : null}
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => updateBlock(block.id, { isActive: !block.isActive }))}
                title={block.isActive ? t.forms.hide : t.forms.show}
                aria-label={block.isActive ? t.forms.hide : t.forms.show}
                className="text-text-3 hover:bg-surface-3 hover:text-text rounded-control flex size-7 items-center justify-center"
              >
                {block.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              {/* Dragging is the way this is meant to be used; these are the
                  way it can be used without a mouse. */}
              <button
                type="button"
                disabled={pending || first}
                onClick={() => run(() => moveBlock(block.id, "up"))}
                aria-label={t.common.moveUp(t.forms.blockNames[block.kind])}
                className="text-text-3 hover:bg-surface-3 hover:text-text rounded-control flex size-7 items-center justify-center disabled:opacity-30"
              >
                <ChevronUp size={14} />
              </button>
              <button
                type="button"
                disabled={pending || last}
                onClick={() => run(() => moveBlock(block.id, "down"))}
                aria-label={t.common.moveDown(t.forms.blockNames[block.kind])}
                className="text-text-3 hover:bg-surface-3 hover:text-text rounded-control flex size-7 items-center justify-center disabled:opacity-30"
              >
                <ChevronDown size={14} />
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => deleteBlock(block.id))}
                aria-label={t.common.deleteThing(t.forms.blockNames[block.kind])}
                className="text-text-3 hover:bg-negative/12 hover:text-negative rounded-control flex size-7 items-center justify-center"
              >
                <Trash2 size={14} />
              </button>
            </span>
          )}
        </div>

        {locked ? (
          <p className="border-border-soft text-text-3 border-t px-3 py-2.5 text-sm">
            {t.forms.heroLocked}
          </p>
        ) : null}

        {open && configurable ? (
          <div className="border-border-soft animate-fade space-y-3 border-t px-3 py-3">
            <label className="block">
              <span className="label mb-1.5 block">{t.forms.bandTitle}</span>
              <Input
                value={form.title}
                maxLength={120}
                placeholder={t.forms.blockNames[block.kind]}
                onChange={(event) => set({ title: event.target.value })}
              />
            </label>

            <label className="block">
              <span className="label mb-1.5 block">
                {block.kind === "RICH_TEXT" ? t.forms.bandBody : t.forms.bandSubtitle}
              </span>
              <Textarea
                value={form.subtitle}
                rows={block.kind === "RICH_TEXT" ? 4 : 2}
                maxLength={240}
                placeholder={t.common.optional}
                onChange={(event) => set({ subtitle: event.target.value })}
              />
            </label>

            {countable ? (
              <label className="block">
                <span className="label mb-1.5 block">{t.forms.howMany}</span>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={form.limit}
                  onChange={(event) => {
                    const next = Number.parseInt(event.target.value, 10);
                    set({ limit: Number.isSafeInteger(next) ? next : 1 });
                  }}
                  className="tnum"
                />
              </label>
            ) : null}

            {scopeable ? (
              <label className="block">
                <span className="label mb-1.5 block">{t.forms.limitToSection}</span>
                <Select
                  value={form.categoryId}
                  onChange={(event) => set({ categoryId: event.target.value })}
                >
                  <option value="">
                    {block.kind === "FEATURED_FORMS" ? t.forms.featuredOnly : t.forms.everything}
                  </option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </label>
            ) : null}

            <SaveBar
              draft={draft}
              save={(values) =>
                updateBlock(block.id, {
                  title: values.title,
                  subtitle: values.subtitle,
                  limit: values.limit,
                  categoryId: values.categoryId || null,
                })
              }
            />
          </div>
        ) : null}
      </Card>

      {/* The edge, pulled. Sits on the card's boundary and is the full height
          of it, so there is nothing to aim for. */}
      {locked ? null : (
        <button
          type="button"
          onPointerDown={startResize}
          aria-label={t.forms.bandWidth}
          title={t.forms.bandWidth}
          className="group/grip absolute inset-y-2 -right-2 flex w-4 cursor-col-resize items-center justify-center"
        >
          <span className="bg-line-strong group-hover/grip:bg-brand h-8 w-1 rounded-full transition-colors" />
        </button>
      )}
    </li>
  );
}
