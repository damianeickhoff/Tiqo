"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { ChevronDown, ChevronUp, Eye, EyeOff, Pin, PinOff, Plus, Trash2 } from "lucide-react";
import { ConfirmDelete } from "@/components/confirm-delete";
import {
  createCategory,
  deleteCategory,
  moveCategory,
  updateCategory,
} from "@/lib/actions/portal-admin";
import { PORTAL_ICONS, PortalIcon } from "@/components/portal/portal-icon";
import { Button, Card, FieldError, FormError, Input, Select } from "@/components/ui";
import { SaveBar, useDraft } from "@/components/settings/draft";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

type Category = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string;
  isActive: boolean;
  parentId: string | null;
  /// Its place on the front page's shelf, or null when it is not on it.
  leadsPortal: number | null;
  _count: { forms: number; articles: number; children: number };
};

/**
 * The catalogue, as the tree it is: sections with sub-sections under them, one
 * level deep. Deeper than that and nobody finishes browsing.
 */
export function CatalogueManager({ categories }: { categories: Category[] }) {
  const t = useMessages();
  const [state, formAction] = useActionState(createCategory, undefined);
  const errors = state?.errors ?? {};

  const roots = categories.filter((category) => !category.parentId);
  const childrenOf = (id: string) => categories.filter((category) => category.parentId === id);

  return (
    <div className="space-y-4">
      {roots.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-text-3 text-md">{t.forms.noSections}</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {roots.map((category, index) => (
            <li key={category.id}>
              <Card className="overflow-hidden">
                <CategoryRow
                  category={category}
                  first={index === 0}
                  last={index === roots.length - 1}
                />

                {childrenOf(category.id).length > 0 ? (
                  <ul className="border-border-soft divide-border-soft divide-y border-t">
                    {childrenOf(category.id).map((child, childIndex, all) => (
                      <li key={child.id} className="pl-8">
                        <CategoryRow
                          category={child}
                          first={childIndex === 0}
                          last={childIndex === all.length - 1}
                        />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Card className="p-4">
        <form action={formAction} className="space-y-3">
          <p className="label">{t.forms.newSection}</p>
          <FormError>{errors.form}</FormError>

          <div className="flex flex-wrap items-end gap-3">
            <label className="block min-w-[12rem] flex-1">
              <span className="label mb-1.5 block">{t.settings.name}</span>
              <Input name="name" maxLength={60} placeholder={t.forms.sectionPlaceholder} />
            </label>

            <label className="block">
              <span className="label mb-1.5 block">{t.forms.under}</span>
              <Select name="parentId" defaultValue="" className="w-auto">
                <option value="">{t.forms.topLevel}</option>
                {categories
                  .filter((category) => !category.parentId)
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </Select>
            </label>

            <label className="block">
              <span className="label mb-1.5 block">{t.forms.icon}</span>
              <Select name="icon" defaultValue="help" className="w-auto">
                {Object.keys(PORTAL_ICONS).map((icon) => (
                  <option key={icon} value={icon}>
                    {icon}
                  </option>
                ))}
              </Select>
            </label>

            <label className="block">
              <span className="label mb-1.5 block">{t.settings.colour}</span>
              <input
                type="color"
                name="color"
                defaultValue="#febe2e"
                aria-label={t.settings.colour}
                className="bg-surface rounded-control h-11 w-12 cursor-pointer border border-transparent p-1 shadow-[var(--highlight)]"
              />
            </label>

            <AddButton />
          </div>

          <FieldError>{errors.name}</FieldError>
        </form>
      </Card>
    </div>
  );
}

function CategoryRow({
  category,
  first,
  last,
}: {
  category: Category;
  first: boolean;
  last: boolean;
}) {
  const t = useMessages();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const draft = useDraft({
    name: category.name,
    description: category.description ?? "",
    icon: category.icon ?? "help",
    color: category.color,
  });
  const { draft: form, set } = draft;

  function run(work: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await work();
      setError(result.ok ? null : (result.error ?? t.errors.generic));
    });
  }

  return (
    <div className={cn("group", !category.isActive && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <span
          aria-hidden
          className="rounded-control flex size-9 shrink-0 items-center justify-center"
          style={{
            background: `color-mix(in oklab, ${form.color} 15%, transparent)`,
            color: form.color,
          }}
        >
          <PortalIcon name={form.icon} size={17} />
        </span>

        <span className="min-w-[12rem] flex-1 space-y-1">
          <Input
            value={form.name}
            maxLength={60}
            aria-label={t.settings.name}
            onChange={(event) => set({ name: event.target.value })}
            className="text-md h-8 border-transparent bg-transparent px-1 font-semibold"
          />
          <Input
            value={form.description}
            maxLength={200}
            placeholder={t.forms.sectionBlurb}
            aria-label={t.forms.sectionBlurb}
            onChange={(event) => set({ description: event.target.value })}
            className="text-text-3 h-7 border-transparent bg-transparent px-1 text-sm"
          />
        </span>

        <span className="text-text-3 shrink-0 text-sm">
          {t.forms.formCount(category._count.forms)}
          {category._count.articles > 0
            ? ` · ${t.forms.articleCount(category._count.articles)}`
            : ""}
        </span>

        <Select
          value={form.icon}
          aria-label={t.forms.icon}
          onChange={(event) => set({ icon: event.target.value })}
          className="h-8 w-auto text-sm opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
        >
          {Object.keys(PORTAL_ICONS).map((icon) => (
            <option key={icon} value={icon}>
              {icon}
            </option>
          ))}
        </Select>

        <input
          type="color"
          value={form.color}
          aria-label={t.settings.colour}
          onChange={(event) => set({ color: event.target.value })}
          className="bg-surface rounded-control h-8 w-9 shrink-0 cursor-pointer border border-transparent p-1 opacity-0 shadow-[var(--highlight)] transition-opacity group-hover:opacity-100"
        />

        <span className="flex shrink-0 items-center gap-0.5">
          {/* Only a top-level section can lead the front page: the shelf is the
              way into the catalogue, and a sub-section is already inside it. */}
          {category.parentId === null ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() =>
                  updateCategory(category.id, { leadsPortal: category.leadsPortal === null }),
                )
              }
              title={category.leadsPortal === null ? t.forms.leadsPortalOn : t.forms.leadsPortalOff}
              aria-label={
                category.leadsPortal === null ? t.forms.leadsPortalOn : t.forms.leadsPortalOff
              }
              aria-pressed={category.leadsPortal !== null}
              className={cn(
                "rounded-control flex size-8 items-center justify-center",
                category.leadsPortal === null
                  ? "text-text-3 hover:bg-surface-3 hover:text-text"
                  : "text-brand-deep bg-[var(--brand-tint)]",
              )}
            >
              {category.leadsPortal === null ? <PinOff size={14} /> : <Pin size={14} />}
            </button>
          ) : null}
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => updateCategory(category.id, { isActive: !category.isActive }))}
            title={category.isActive ? t.forms.hide : t.forms.show}
            aria-label={category.isActive ? t.forms.hide : t.forms.show}
            className="text-text-3 hover:bg-surface-3 hover:text-text rounded-control flex size-8 items-center justify-center"
          >
            {category.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          <button
            type="button"
            disabled={pending || first}
            onClick={() => run(() => moveCategory(category.id, "up"))}
            aria-label={t.common.moveUp(category.name)}
            className="text-text-3 hover:bg-surface-3 hover:text-text rounded-control flex size-8 items-center justify-center disabled:opacity-30"
          >
            <ChevronUp size={15} />
          </button>
          <button
            type="button"
            disabled={pending || last}
            onClick={() => run(() => moveCategory(category.id, "down"))}
            aria-label={t.common.moveDown(category.name)}
            className="text-text-3 hover:bg-surface-3 hover:text-text rounded-control flex size-8 items-center justify-center disabled:opacity-30"
          >
            <ChevronDown size={15} />
          </button>
          <ConfirmDelete
            title={t.common.deleteThing(category.name)}
            run={async () => run(() => deleteCategory(category.id))}
          >
            {(ask) => (
              <button
                type="button"
                onClick={ask}
                aria-label={t.common.deleteThing(category.name)}
                title={t.forms.deleteSectionHint}
                className="text-text-3 hover:bg-negative/12 hover:text-negative rounded-control flex size-8 items-center justify-center"
              >
                <Trash2 size={14} />
              </button>
            )}
          </ConfirmDelete>
        </span>
      </div>

      {draft.dirty ? (
        <div className="animate-fade px-4 py-2.5">
          <SaveBar
            draft={draft}
            save={(values) =>
              updateCategory(category.id, {
                name: values.name,
                description: values.description,
                icon: values.icon,
                color: values.color,
              })
            }
          />
        </div>
      ) : null}

      {error ? (
        <p className="text-negative bg-negative/[0.06] px-4 py-2 text-sm font-medium">{error}</p>
      ) : null}
    </div>
  );
}

function AddButton() {
  const { pending } = useFormStatus();
  const t = useMessages();
  return (
    <Button type="submit" disabled={pending}>
      <Plus size={15} strokeWidth={2.5} />
      {pending ? t.common.adding : t.forms.addSection}
    </Button>
  );
}
