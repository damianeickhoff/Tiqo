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
  LifeBuoy,
  Lock,
  Megaphone,
  Plus,
  Search,
  Settings2,
  SquareStack,
  Star,
  Text,
  Trash2,
  Upload,
} from "lucide-react";
import type { PortalBlockKind, PortalHeroStyle } from "@/generated/prisma/enums";
import {
  addBlock,
  deleteBlock,
  moveBlock,
  reorderBlocks,
  updateBlock,
  uploadHeroImage,
} from "@/lib/actions/portal-admin";
import { Button, Card, FieldError, Input, Select, Textarea } from "@/components/ui";
import { SaveBar, useDraft } from "@/components/settings/draft";
import { COLUMN_SPAN, COLUMNS, RAIL_KINDS, isFullWidth } from "@/lib/portal-layout";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

const BLOCK_ICONS: Record<PortalBlockKind, typeof Search> = {
  HERO: Search,
  ANNOUNCEMENTS: Megaphone,
  CATEGORIES: SquareStack,
  FEATURED_FORMS: Star,
  ARTICLES: BookOpen,
  MY_REQUESTS: Inbox,
  DESK_CARD: LifeBuoy,
  RICH_TEXT: Text,
};

/*
 * What can be added to the front page.
 *
 * The hero is the portal's front door and is the same on every desk, so it is
 * not something to add, move or rewrite — only the bands under it are. Notices
 * are not here either: every live one now shows as a band under the bar on
 * every page of the portal, so a band that repeated them on the front page
 * said the same sentence twice. A page that still has one draws nothing, and
 * its card says so.
 */
const GLOBAL_KINDS: PortalBlockKind[] = ["HERO", "ANNOUNCEMENTS"];
const KINDS = (Object.keys(BLOCK_ICONS) as PortalBlockKind[]).filter(
  (kind) => !GLOBAL_KINDS.includes(kind),
);

export type Block = {
  id: string;
  kind: PortalBlockKind;
  title: string | null;
  subtitle: string | null;
  limit: number | null;
  categoryId: string | null;
  isActive: boolean;
  span: number;
  /// Only the search band reads these.
  heroStyle: PortalHeroStyle;
  heroColor: string | null;
  heroColor2: string | null;
  heroImage: string | null;
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
          <div className="space-y-3">
            {shape(order).map((group, groupIndex) => {
              const cards = (blocks: Block[]) =>
                blocks.map((block) => (
                  <BlockCard
                    key={block.id}
                    block={block}
                    categories={categories}
                    first={order[0]?.id === block.id}
                    last={order[order.length - 1]?.id === block.id}
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
                ));

              return group.rail ? (
                <div
                  key={groupIndex}
                  className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]"
                >
                  <ol className="flex flex-col gap-3">{cards(group.items)}</ol>
                  <ol className="flex flex-col gap-3">{cards(group.rail)}</ol>
                </div>
              ) : (
                <ol key={groupIndex} className="flex flex-col gap-3">
                  {cards(group.items)}
                </ol>
              );
            })}
          </div>
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
                      className="bg-surface hover:border-brand/45 rounded-card flex w-full items-start gap-2.5 border border-transparent px-3 py-2.5 text-left shadow-[var(--highlight)] transition-colors hover:bg-[var(--brand-tint)]"
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
    <div className="rounded-panel bg-bg overflow-hidden">
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
    heroStyle: block.heroStyle,
    heroColor: block.heroColor ?? "#2f5be8",
    heroColor2: block.heroColor2 ?? "",
    heroImage: block.heroImage ?? "",
  });
  const { draft: form, set } = draft;

  const Icon = BLOCK_ICONS[block.kind];
  // Locked bands have no width to set: the hero and the shelf run the whole
  // page, notices are drawn by the shell on every page, and what is theirs
  // always sits in the column on the right whatever width it is given.
  const locked =
    block.kind === "HERO" || block.kind === "ANNOUNCEMENTS" || block.kind === "MY_REQUESTS";
  const configurable = block.kind !== "ANNOUNCEMENTS";
  // The search band has nothing to word — the greeting and the welcome line are
  // settings — but it does have a face, and this is where somebody is standing
  // when they want to change it.
  const paintable = block.kind === "HERO";
  const countable = ["CATEGORIES", "FEATURED_FORMS", "ARTICLES", "MY_REQUESTS"].includes(
    block.kind,
  );
  const scopeable = ["CATEGORIES", "FEATURED_FORMS", "ARTICLES"].includes(block.kind);

  /**
   * Pulling the right edge.
   *
   * There are two places a band can be — across the page, or in the left
   * column beside the right one — so the edge snaps between them rather than
   * offering six widths the portal has no way to draw. The position is taken
   * from the pointer's distance across the row rather than from how far it has
   * moved, so a slow drag and a fast one land in the same place. Pointer
   * capture keeps the drag alive when the cursor leaves the handle, which it
   * does immediately.
   */
  function startResize(event: React.PointerEvent<HTMLButtonElement>) {
    if (locked) return;
    const row = item.current?.parentElement;
    if (!row) return;

    const box = row.getBoundingClientRect();
    // Not every pointer can be captured; the window listeners below are what
    // actually keep the drag alive, so a refusal is not worth failing over.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {}

    const spanAt = (x: number) => (x - box.left > box.width * 0.75 ? COLUMNS : COLUMN_SPAN);

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
      className={cn("relative", dragging && "opacity-40", over && "ring-brand rounded-card ring-2")}
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
              {RAIL_KINDS.includes(block.kind)
                ? t.forms.widthRail
                : isFullWidth(block)
                  ? t.forms.widthFull
                  : t.forms.widthColumn}
            </span>
          </span>

          {draft.dirty ? (
            <span className="bg-brand size-1.5 shrink-0 rounded-full" title={t.common.unsaved} />
          ) : null}

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
            {locked ? null : (
              <>
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
              </>
            )}
          </span>
        </div>

        {/* A band that cannot be moved says why it is where it is, rather than
            leaving somebody hunting for a handle that was never there. */}
        {locked ? (
          <p className="text-text-3 px-3 py-2.5 text-sm">{t.forms.blockHints[block.kind]}</p>
        ) : null}

        {open && configurable ? (
          <div className="animate-fade space-y-3 px-3 py-3">
            {paintable ? <HeroPaint form={form} set={set} /> : null}

            {paintable ? null : (
              <>
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
                        {block.kind === "FEATURED_FORMS"
                          ? t.forms.featuredOnly
                          : t.forms.everything}
                      </option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </Select>
                  </label>
                ) : null}
              </>
            )}

            <SaveBar
              draft={draft}
              save={(values) =>
                paintable
                  ? updateBlock(block.id, {
                      heroStyle: values.heroStyle,
                      heroColor: values.heroColor,
                      heroColor2: values.heroColor2,
                      heroImage: values.heroImage,
                    })
                  : updateBlock(block.id, {
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

/**
 * What the search band is painted with.
 *
 * Four choices rather than a free field: the brand, one colour, two colours
 * blended, or a picture. The swatch above them is the answer to the only
 * question anybody is really asking — what will it look like — and it is drawn
 * from the draft, so it answers before the Save rather than after it.
 */
function HeroPaint({
  form,
  set,
}: {
  form: {
    heroStyle: PortalHeroStyle;
    heroColor: string;
    heroColor2: string;
    heroImage: string;
  };
  set: (
    patch: Partial<{
      heroStyle: PortalHeroStyle;
      heroColor: string;
      heroColor2: string;
      heroImage: string;
    }>,
  ) => void;
}) {
  const t = useMessages();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const STYLES: PortalHeroStyle[] = ["BRAND", "SOLID", "GRADIENT", "IMAGE"];

  // The upload is a write of its own — the picture is stored the moment it is
  // chosen, because there is nothing to preview until it is. What it writes
  // into is the draft, so the band itself still changes only on Save.
  function upload(file: File) {
    setProblem(null);
    setBusy(true);
    void uploadHeroImage(file)
      .then((result) => {
        if (result.ok) set({ heroImage: result.url });
        else setProblem(result.error);
      })
      .finally(() => setBusy(false));
  }

  const swatch =
    form.heroStyle === "BRAND"
      ? "linear-gradient(115deg, var(--brand) 0%, var(--brand-2) 100%)"
      : form.heroStyle === "SOLID"
        ? form.heroColor
        : form.heroStyle === "GRADIENT"
          ? `linear-gradient(115deg, ${form.heroColor} 0%, ${form.heroColor2 || form.heroColor} 100%)`
          : form.heroImage
            ? `center / cover no-repeat url(${JSON.stringify(form.heroImage)})`
            : "var(--surface-2)";

  return (
    <div className="space-y-3">
      <span className="label block">{t.forms.heroPaint}</span>

      <div
        aria-hidden
        className="rounded-card h-16 w-full"
        style={{ background: swatch, boxShadow: "var(--highlight)" }}
      />

      <div className="bg-surface-2 flex gap-1 rounded-full p-1">
        {STYLES.map((style) => (
          <button
            key={style}
            type="button"
            aria-pressed={form.heroStyle === style}
            onClick={() => set({ heroStyle: style })}
            className={cn(
              "h-8 flex-1 rounded-full text-sm font-medium transition-colors",
              form.heroStyle === style
                ? "bg-surface text-text shadow-[var(--highlight)]"
                : "text-text-2 hover:text-text",
            )}
          >
            {t.forms.heroStyles[style]}
          </button>
        ))}
      </div>

      {form.heroStyle === "SOLID" || form.heroStyle === "GRADIENT" ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="label mb-1.5 block">
              {form.heroStyle === "GRADIENT" ? t.forms.heroFrom : t.settings.colour}
            </span>
            <span className="flex items-center gap-2">
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(form.heroColor) ? form.heroColor : "#2f5be8"}
                onChange={(event) => set({ heroColor: event.target.value })}
                aria-label={t.settings.pickColour}
                className="bg-surface rounded-control h-11 w-12 cursor-pointer border border-transparent p-1 shadow-[var(--highlight)]"
              />
              <Input
                value={form.heroColor}
                onChange={(event) => set({ heroColor: event.target.value })}
                spellCheck={false}
                className="w-28 font-mono"
              />
            </span>
          </label>

          {form.heroStyle === "GRADIENT" ? (
            <label className="block">
              <span className="label mb-1.5 block">{t.forms.heroTo}</span>
              <span className="flex items-center gap-2">
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(form.heroColor2) ? form.heroColor2 : "#1b3fa8"}
                  onChange={(event) => set({ heroColor2: event.target.value })}
                  aria-label={t.settings.pickColour}
                  className="bg-surface rounded-control h-11 w-12 cursor-pointer border border-transparent p-1 shadow-[var(--highlight)]"
                />
                <Input
                  value={form.heroColor2}
                  placeholder={t.forms.heroToAuto}
                  onChange={(event) => set({ heroColor2: event.target.value })}
                  spellCheck={false}
                  className="w-28 font-mono"
                />
              </span>
            </label>
          ) : null}
        </div>
      ) : null}

      {form.heroStyle === "IMAGE" ? (
        <div className="space-y-2">
          <span className="label block">{t.forms.heroImage}</span>

          <div className="flex flex-wrap items-center gap-2">
            {/* Upload or paste: a desk with the picture on its own machine
                should not have to put it on the web first, and a desk that
                already keeps its artwork somewhere should not have to copy it
                in here. Either way the field ends up holding an address. */}
            <label
              className={cn(
                "bg-surface text-text hover:bg-surface-2 inline-flex h-[42px] shrink-0 cursor-pointer items-center gap-2 rounded-full px-4 text-base font-medium shadow-[var(--highlight)] transition-colors",
                busy && "pointer-events-none opacity-60",
              )}
            >
              <Upload size={15} />
              {busy ? t.common.saving : t.forms.heroUpload}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  // The picker keeps the file selected, so choosing the same
                  // one twice after a failure would otherwise do nothing.
                  event.target.value = "";
                  if (file) upload(file);
                }}
              />
            </label>

            <Input
              value={form.heroImage}
              placeholder="https://"
              onChange={(event) => set({ heroImage: event.target.value })}
              spellCheck={false}
              className="min-w-[12rem] flex-1"
            />
          </div>

          {problem ? <FieldError>{problem}</FieldError> : null}
          <span className="text-text-3 block text-sm">{t.forms.heroImageHint}</span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The page's own placement, applied to the schematic.
 *
 * The portal puts what is theirs and what the desk is doing in a column on the
 * right, runs everything else down the left in order, and lets a band given
 * the whole row break the two columns apart. Drawing that here rather than a
 * plain six-column grid is the difference between a diagram of this page and a
 * diagram of some page: side by side in the designer has to mean side by side
 * in the portal.
 */
function shape(order: Block[]): { items: Block[]; rail?: Block[] }[] {
  const rail = order.filter((block) => RAIL_KINDS.includes(block.kind));
  const stream = order.filter((block) => !RAIL_KINDS.includes(block.kind));

  const runs: { items: Block[]; full: boolean }[] = [];
  for (const block of stream) {
    const full = isFullWidth(block);
    const last = runs.at(-1);
    if (full || !last || last.full) runs.push({ items: [block], full });
    else last.items.push(block);
  }

  const narrow = runs.findIndex((run) => !run.full);
  if (rail.length === 0) return runs.map(({ items }) => ({ items }));
  if (narrow < 0) return [...runs.map(({ items }) => ({ items })), { items: [], rail }];

  return runs.map(({ items }, index) => (index === narrow ? { items, rail } : { items }));
}
