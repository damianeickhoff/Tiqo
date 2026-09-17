"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { ChevronRight, Copy, Plus, Search, X } from "lucide-react";
import { createForm, duplicateForm } from "@/lib/actions/portal-admin";
import { TYPE_ORDER } from "@/lib/tickets";
import { PortalIcon } from "@/components/portal/portal-icon";
import { SectionPicker } from "@/components/settings/section-picker";
import { Modal } from "@/components/modal";
import { Button, Card, FieldError, FormError, Input, Select } from "@/components/ui";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

type FormRow = {
  id: string;
  name: string;
  summary: string | null;
  icon: string | null;
  color: string;
  isActive: boolean;
  type: "QUESTION" | "INCIDENT" | "CHANGE";
  categoryId: string | null;
  /// Tickets this form has raised since the first of the month.
  raised: number;
};

type Category = { id: string; name: string; parentId: string | null };

/** The filters as chips, the way the queue draws its own. */
const CHIP_SELECT =
  "select-chevron h-8 cursor-pointer appearance-none rounded-full border border-line bg-surface " +
  "pr-7 pl-2.5 text-sm font-medium text-text-2 shadow-[var(--highlight)] " +
  "transition-[border-color,color] hover:border-line-strong hover:text-text " +
  "focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-[var(--brand-tint)]";
const CHIP_ON = "border-transparent bg-[var(--brand-tint)] text-brand-deep";

export function FormLibrary({
  forms,
  categories,
  language,
}: {
  forms: FormRow[];
  categories: Category[];
  /// The instance's language, as the two-letter code shown on every row.
  language: string;
}) {
  const t = useMessages();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [state, setState] = useState("");
  const [creating, setCreating] = useState(false);

  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return forms.filter((form) => {
      if (type && form.type !== type) return false;
      if (state === "live" && !form.isActive) return false;
      if (state === "hidden" && form.isActive) return false;
      if (!needle) return true;
      return (
        form.name.toLowerCase().includes(needle) ||
        (form.summary ?? "").toLowerCase().includes(needle) ||
        (byId.get(form.categoryId ?? "")?.name ?? "").toLowerCase().includes(needle)
      );
    });
  }, [forms, query, type, state, byId]);

  // Grouped by section, in the catalogue's own order, so the library reads the
  // way the portal does rather than as one flat wall.
  const groups = useMemo(() => {
    const map = new Map<string, FormRow[]>();
    for (const form of shown) {
      const key = form.categoryId ?? "none";
      map.set(key, [...(map.get(key) ?? []), form]);
    }
    return [
      ...categories
        .filter((category) => map.has(category.id))
        .map((category) => ({
          id: category.id,
          name: category.parentId
            ? `${byId.get(category.parentId)?.name ?? ""} · ${category.name}`
            : category.name,
          rows: map.get(category.id)!,
        })),
      ...(map.has("none") ? [{ id: "none", name: t.forms.noSection, rows: map.get("none")! }] : []),
    ];
  }, [shown, categories, byId, t]);

  const filtering = Boolean(query.trim() || type || state);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-72 max-w-full">
          <Search
            size={14}
            aria-hidden
            className="text-text-3 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.forms.searchForms}
            aria-label={t.forms.searchForms}
            className="border-line bg-surface placeholder:text-text-3 focus:border-brand hover:border-line-strong rounded-control h-8 w-full border pr-3 pl-8 text-base shadow-[var(--highlight)] transition-[border-color,box-shadow] focus:ring-[3px] focus:ring-[var(--brand-tint)] focus:outline-none"
          />
        </div>

        <select
          value={type}
          onChange={(event) => setType(event.target.value)}
          aria-label={t.ticket.type}
          className={cn(CHIP_SELECT, type && CHIP_ON)}
        >
          <option value="">{t.tickets.anyType}</option>
          {TYPE_ORDER.map((value) => (
            <option key={value} value={value}>
              {t.vocab.type[value]}
            </option>
          ))}
        </select>

        <select
          value={state}
          onChange={(event) => setState(event.target.value)}
          aria-label={t.forms.state}
          className={cn(CHIP_SELECT, state && CHIP_ON)}
        >
          <option value="">{t.forms.anyState}</option>
          <option value="live">{t.forms.live}</option>
          <option value="hidden">{t.forms.hidden}</option>
        </select>

        {filtering ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setType("");
              setState("");
            }}
            className="text-text-2 hover:text-text flex h-8 items-center gap-1 rounded-full px-2 text-sm font-medium"
          >
            <X size={12} strokeWidth={2.5} />
            {t.tickets.clear}
          </button>
        ) : null}

        <span className="text-text-3 px-1 text-sm">
          {t.forms.showing(shown.length, forms.length)}
        </span>

        <Button type="button" size="sm" onClick={() => setCreating(true)} className="ml-auto">
          <Plus size={14} strokeWidth={2.5} />
          {t.forms.addForm}
        </Button>
      </div>

      {shown.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-text-3 text-md">
            {forms.length === 0 ? t.forms.noForms : t.forms.noMatches}
          </p>
        </Card>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.id}>
              <p className="label mb-2 flex items-center gap-2">
                {group.name}
                <span className="font-mono tracking-normal">{group.rows.length}</span>
              </p>
              <Card className="overflow-hidden">
                <ul className="divide-line divide-y">
                  {group.rows.map((form) => (
                    <FormRowItem key={form.id} form={form} language={language} />
                  ))}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}

      {creating ? (
        <NewFormDialog categories={categories} onClose={() => setCreating(false)} />
      ) : null}
    </div>
  );
}

function FormRowItem({ form, language }: { form: FormRow; language: string }) {
  const t = useMessages();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(work: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await work();
      setError(result.ok ? null : (result.error ?? t.errors.generic));
    });
  }

  return (
    <li className="group">
      <div className="hover:bg-surface-2 flex min-h-[52px] items-center gap-3 px-3.5 py-2 transition-[background-color]">
        <span
          aria-hidden
          className={cn(
            "rounded-control flex size-8 shrink-0 items-center justify-center",
            !form.isActive && "opacity-50",
          )}
          style={{
            background: `color-mix(in oklab, ${form.color} 15%, transparent)`,
            color: form.color,
          }}
        >
          <PortalIcon name={form.icon} size={16} />
        </span>

        <Link href={`/settings/portal/forms/${form.id}`} className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate text-base font-semibold",
              !form.isActive && "text-text-2",
            )}
          >
            {form.name}
          </span>
          <span className="text-text-3 mt-0.5 flex flex-wrap items-center gap-x-2 text-sm">
            {/* What it raises, then how often — the two questions asked of a
                form nobody remembers writing. */}
            <span className="text-text-2 font-medium">{t.vocab.type[form.type]}</span>
            <span aria-hidden>·</span>
            {t.forms.raisedThisMonth(form.raised)}
            {form.summary ? (
              <>
                <span aria-hidden>·</span>
                <span className="truncate">{form.summary}</span>
              </>
            ) : null}
          </span>
        </Link>

        <span
          title={t.forms.language}
          className="text-text-2 hidden h-5 items-center rounded-full bg-[color-mix(in_oklab,var(--text)_6%,transparent)] px-2 font-mono text-xs font-medium sm:inline-flex"
        >
          {language}
        </span>

        <span
          className="ml-6 flex w-16 shrink-0 items-center gap-1.5 text-sm"
          style={{ color: form.isActive ? "var(--positive)" : "var(--text-3)" }}
        >
          <span aria-hidden className="size-1.5 rounded-full bg-current" />
          {form.isActive ? t.forms.live : t.forms.hidden}
        </span>

        <span className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => duplicateForm(form.id))}
            title={t.forms.duplicate}
            aria-label={t.forms.duplicate}
            className="text-text-3 hover:bg-surface-3 hover:text-text rounded-control flex size-8 items-center justify-center opacity-0 transition-colors group-hover:opacity-100"
          >
            <Copy size={14} />
          </button>

          <Link
            href={`/settings/portal/forms/${form.id}`}
            aria-label={t.plan.configure}
            className="text-text-3 hover:text-text rounded-control flex size-8 items-center justify-center"
          >
            <ChevronRight size={15} />
          </Link>
        </span>
      </div>

      {error ? (
        <p className="text-negative bg-negative/[0.06] px-4 py-2 text-sm font-medium">{error}</p>
      ) : null}
    </li>
  );
}

function NewFormDialog({ categories, onClose }: { categories: Category[]; onClose: () => void }) {
  const t = useMessages();
  const [state, formAction] = useActionState(createForm, undefined);
  const [categoryId, setCategoryId] = useState("");
  const errors = state?.errors ?? {};

  return (
    <Modal title={t.forms.newForm} description={t.forms.newFormBlurb} onClose={onClose}>
      <form action={formAction} className="space-y-4">
        <FormError>{errors.form}</FormError>

        <label className="block">
          <span className="label mb-1.5 block">{t.settings.name}</span>
          <Input name="name" autoFocus maxLength={80} placeholder={t.forms.namePlaceholder} />
          <FieldError>{errors.name}</FieldError>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label mb-1.5 block">{t.ticket.type}</span>
            <Select name="type" defaultValue="QUESTION">
              {TYPE_ORDER.map((type) => (
                <option key={type} value={type}>
                  {t.vocab.type[type]}
                </option>
              ))}
            </Select>
          </label>

          <div className="block">
            <span className="label mb-1.5 block">{t.forms.section}</span>
            <SectionPicker
              value={categoryId}
              name="categoryId"
              sections={categories}
              onChange={setCategoryId}
            />
          </div>
        </div>

        <div className="border-border-soft flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Create />
        </div>
      </form>
    </Modal>
  );
}

function Create() {
  const { pending } = useFormStatus();
  const t = useMessages();
  return (
    <Button type="submit" disabled={pending}>
      <Plus size={15} strokeWidth={2.5} />
      {pending ? t.common.creating : t.forms.addForm}
    </Button>
  );
}
