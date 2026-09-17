"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react";
import { createSpace, deleteSpace, moveSpace, updateSpace } from "@/lib/actions/docs";
import { REVIEW_INTERVALS, spaceHref } from "@/lib/docs";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Modal } from "@/components/modal";
import { Button, Field, FieldError, FormError, Input, Select, Textarea } from "@/components/ui";
import { useDraft } from "@/components/settings/draft";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

export type SpaceRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  color: string;
  teamId: string | null;
  reviewDays: number;
  portalCategoryId: string | null;
  docs: number;
  stale: number;
};

type Option = { id: string; name: string };

/** What the dialog holds while somebody is filling it in. */
type Draft = {
  key: string;
  name: string;
  description: string;
  color: string;
  teamId: string;
  reviewDays: number;
  portalCategoryId: string;
};

const BLANK: Draft = {
  key: "",
  name: "",
  description: "",
  color: "#febe2e",
  teamId: "",
  reviewDays: 180,
  portalCategoryId: "",
};

/** The colours a shelf is told apart by. Seven, because eight would already be
 *  two that look alike at the size a key tile is drawn. */
const COLOURS = ["#febe2e", "#6366f1", "#0ea5e9", "#10b981", "#f43f5e", "#f97316", "#9d9da6"];

/**
 * The shelves, and what each one costs the desk.
 *
 * A table rather than a list of names, because the questions somebody opens
 * this page with are comparative: which shelf is drifting, which team answers
 * for what, and which of them feeds the portal. Adding, reordering and
 * deleting are list-level commands and take effect at once; what is *inside*
 * the dialog is a draft with a Save.
 */
export function SpaceManager({
  spaces,
  teams,
  categories,
}: {
  spaces: SpaceRow[];
  teams: Option[];
  categories: Option[];
}) {
  const t = useMessages();
  const [editing, setEditing] = useState<SpaceRow | "new" | null>(null);
  const [pending, startTransition] = useTransition();

  const columns =
    "grid-cols-[32px_minmax(0,1fr)_120px_60px_60px_96px_minmax(0,140px)_64px] items-center gap-3";

  return (
    <div className="space-y-3">
      {spaces.length === 0 ? (
        <p className="border-line text-text-3 rounded-card border border-dashed px-4 py-8 text-center text-base">
          {t.docs.noSpacesBody}
        </p>
      ) : (
        // Eight columns do not fit the settings column on a laptop, and the
        // answer to that is a table that scrolls rather than a table with its
        // names cut in half.
        <div className="card overflow-x-auto">
          <div className="min-w-[46rem]">
            <div
              className={cn(
                "label border-line bg-surface-2 hidden border-b px-3 py-2 lg:grid",
                columns,
              )}
            >
              <span />
              <span>{t.docs.space}</span>
              <span>{t.docs.answersForIt}</span>
              <span>{t.docs.pagesColumn}</span>
              <span>{t.docs.staleColumn}</span>
              {/* What the interval is *for*, said in the heading: the column
                  is the one place the staleness rule is visible from the
                  settings page without opening a dialog. */}
              <span>{t.docs.staleAfter}</span>
              <span>{t.docs.portalCategory}</span>
              <span />
            </div>

            <ul className="divide-line divide-y">
              {spaces.map((space, index) => (
                <li
                  key={space.id}
                  className={cn("group flex flex-wrap px-3 py-2.5 lg:grid", columns)}
                >
                  <span
                    aria-hidden
                    className="flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-semibold"
                    style={{
                      background: `color-mix(in oklab, ${space.color} 16%, transparent)`,
                      color: `color-mix(in oklab, ${space.color} 70%, var(--text))`,
                    }}
                  >
                    {space.key.slice(0, 3)}
                  </span>

                  <span className="ml-3 min-w-0 flex-1 lg:ml-0">
                    <Link
                      href={spaceHref(space.key)}
                      className="hover:text-brand-deep block truncate text-base font-medium transition-colors"
                    >
                      {space.name}
                    </Link>
                    <span className="text-text-3 block truncate text-sm">
                      {space.description ?? space.key}
                    </span>
                  </span>

                  <span className="text-text-2 hidden truncate text-base lg:block">
                    {teams.find((team) => team.id === space.teamId)?.name ?? (
                      <span className="text-text-3">{t.docs.wholeDesk}</span>
                    )}
                  </span>

                  <span className="text-text-2 tnum hidden text-base lg:block">{space.docs}</span>

                  <span
                    className={cn(
                      "tnum hidden text-base lg:block",
                      space.stale ? "text-negative" : "text-text-3",
                    )}
                  >
                    {space.stale || "—"}
                  </span>

                  <span className="text-text-2 hidden text-base lg:block">
                    {space.reviewDays === 0
                      ? t.docs.neverStale
                      : t.docs.reviewDays(space.reviewDays)}
                  </span>

                  <span className="text-text-2 hidden truncate text-base lg:block">
                    {categories.find((one) => one.id === space.portalCategoryId)?.name ?? (
                      <span className="text-text-3">{t.docs.notPublished}</span>
                    )}
                  </span>

                  <span className="flex shrink-0 items-center justify-end gap-0.5">
                    <Icon
                      label={t.common.moveUp(space.name)}
                      disabled={index === 0 || pending}
                      onClick={() => startTransition(() => void moveSpace(space.id, "up"))}
                    >
                      <ChevronUp size={14} />
                    </Icon>
                    <Icon
                      label={t.common.moveDown(space.name)}
                      disabled={index === spaces.length - 1 || pending}
                      onClick={() => startTransition(() => void moveSpace(space.id, "down"))}
                    >
                      <ChevronDown size={14} />
                    </Icon>
                    <Icon label={t.common.editThing(space.name)} onClick={() => setEditing(space)}>
                      <Pencil size={13} />
                    </Icon>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={() => setEditing("new")}>
          <Plus size={13} />
          {t.docs.addSpace}
        </Button>
        <p className="text-text-3 text-sm">{t.docs.spaceOrderHint}</p>
      </div>

      {editing ? (
        <SpaceDialog
          space={editing === "new" ? null : editing}
          teams={teams}
          categories={categories}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function Icon({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="text-text-3 hover:bg-surface-3 hover:text-text flex size-7 items-center justify-center rounded-full transition-colors disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/**
 * One shelf, as a draft.
 *
 * Nothing here is written until Save — including the key, which is the one
 * field that has consequences past this dialog: it is the first segment of
 * every address under the space, so changing it moves every page on it.
 *
 * Delete stands on the left, away from Save, because it is the one control in
 * the dialog that cannot be undone by pressing Cancel.
 */
function SpaceDialog({
  space,
  teams,
  categories,
  onClose,
}: {
  space: SpaceRow | null;
  teams: Option[];
  categories: Option[];
  onClose: () => void;
}) {
  const t = useMessages();
  // Through the same hook the rest of the settings area uses, for the one
  // thing this dialog was missing: whether there is anything to save. A Save
  // that is always lit is a Save nobody can tell apart from a Cancel.
  const { draft, dirty, set } = useDraft<Draft>(
    space
      ? {
          key: space.key,
          name: space.name,
          description: space.description ?? "",
          color: space.color,
          teamId: space.teamId ?? "",
          reviewDays: space.reviewDays,
          portalCategoryId: space.portalCategoryId ?? "",
        }
      : BLANK,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function save() {
    const values = {
      key: draft.key,
      name: draft.name,
      description: draft.description || null,
      color: draft.color,
      teamId: draft.teamId || null,
      reviewDays: draft.reviewDays,
      portalCategoryId: draft.portalCategoryId || null,
    };

    startTransition(async () => {
      const result = space ? await updateSpace(space.id, values) : await createSpace(values);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      onClose();
    });
  }

  // Refused while anything is on the shelf, and the refusal says how many —
  // which is the whole of what somebody needs to decide what to do instead.
  async function remove() {
    if (!space) return { ok: false as const, error: t.errors.generic };
    const result = await deleteSpace(space.id);
    if (result.ok) onClose();
    return result;
  }

  return (
    <Modal
      title={space ? t.docs.editSpace : t.docs.addSpace}
      description={t.docs.spaceKeyHint}
      onClose={onClose}
    >
      <div className="space-y-4">
        <FormError>{errors.form}</FormError>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
          <Field label={t.docs.spaceName} htmlFor="space-name">
            <Input
              id="space-name"
              value={draft.name}
              autoFocus
              maxLength={60}
              onChange={(event) => {
                // The key is offered from the name for a new space, so the
                // common case is one field rather than two — and still a real
                // value somebody can overrule, because it is what the URL is
                // made of.
                const name = event.target.value;
                set(
                  space || draft.key
                    ? { name }
                    : {
                        name,
                        key: name
                          .replace(/[^a-zA-Z0-9]/g, "")
                          .slice(0, 8)
                          .toUpperCase(),
                      },
                );
              }}
            />
            <FieldError>{errors.name}</FieldError>
          </Field>

          <Field label={t.docs.spaceKey} htmlFor="space-key">
            <Input
              id="space-key"
              value={draft.key}
              maxLength={8}
              onChange={(event) => set({ key: event.target.value.toUpperCase() })}
              className="font-mono"
            />
            <FieldError>{errors.key}</FieldError>
          </Field>
        </div>

        <Field label={t.docs.spaceDescription} htmlFor="space-description">
          <Textarea
            id="space-description"
            rows={2}
            value={draft.description}
            maxLength={200}
            onChange={(event) => set({ description: event.target.value })}
          />
          <FieldError>{errors.description}</FieldError>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.docs.spaceTeam} hint={t.docs.spaceTeamHint} htmlFor="space-team">
            <Select
              id="space-team"
              value={draft.teamId}
              onChange={(event) => set({ teamId: event.target.value })}
            >
              <option value="">{t.docs.wholeDesk}</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t.docs.spaceColour}>
            <div className="flex items-center gap-2">
              {COLOURS.map((colour) => (
                <button
                  key={colour}
                  type="button"
                  aria-label={colour}
                  aria-pressed={draft.color.toLowerCase() === colour}
                  onClick={() => set({ color: colour })}
                  className="size-5 rounded-full transition-shadow"
                  style={{
                    background: colour,
                    boxShadow:
                      draft.color.toLowerCase() === colour
                        ? "0 0 0 2px var(--surface), 0 0 0 3.5px var(--text)"
                        : "none",
                  }}
                />
              ))}
              <input
                type="color"
                value={draft.color}
                aria-label={t.docs.spaceColour}
                onChange={(event) => set({ color: event.target.value })}
                className="bg-surface rounded-control ml-auto size-7 shrink-0 cursor-pointer border border-transparent p-1 shadow-[var(--highlight)]"
              />
            </div>
            <FieldError>{errors.color}</FieldError>
          </Field>

          <Field label={t.docs.staleAfter} hint={t.docs.spaceReviewHint} htmlFor="space-review">
            <Select
              id="space-review"
              value={String(draft.reviewDays)}
              onChange={(event) => set({ reviewDays: Number(event.target.value) })}
            >
              {REVIEW_INTERVALS.map((days) => (
                <option key={days} value={days}>
                  {days === 0 ? t.docs.neverStale : t.docs.reviewDays(days)}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label={t.docs.portalCategory}
            hint={t.docs.portalCategoryHint}
            htmlFor="space-category"
          >
            <Select
              id="space-category"
              value={draft.portalCategoryId}
              onChange={(event) => set({ portalCategoryId: event.target.value })}
            >
              <option value="">{t.docs.noCategory}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="flex items-center gap-2 pt-4">
          {space ? (
            <ConfirmDelete title={t.common.deleteThing(space.name)} run={remove}>
              {(ask) => (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={ask}
                  className="text-negative mr-auto"
                >
                  <Trash2 size={14} />
                  {t.docs.deleteSpace}
                </Button>
              )}
            </ConfirmDelete>
          ) : null}

          <Button type="button" variant="ghost" className="ml-auto" onClick={onClose}>
            {t.common.cancel}
          </Button>
          {/* Closing is the confirmation a dialog gives: the table behind it
              carries the new name a moment later. What was missing is the other
              half of the rule — a Save that says whether there is anything to
              save. */}
          <Button type="button" disabled={pending || !dirty} onClick={save}>
            {pending ? t.common.saving : t.common.save}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
