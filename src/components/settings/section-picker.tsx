"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, X } from "lucide-react";
import { addCategory } from "@/lib/actions/portal-admin";
import { Input, Select } from "@/components/ui";
import { useMessages } from "@/components/shell/instance-context";

type Section = { id: string; name: string };

/**
 * Choose a section, or make one without leaving the sentence.
 *
 * Realising halfway through describing a form that the section it belongs in
 * does not exist yet is the normal case, not the exception, and being sent to
 * another page to fix it loses everything typed so far.
 */
export function SectionPicker({
  value,
  sections,
  name,
  onChange,
  className,
}: {
  value: string;
  sections: Section[];
  /** Set when the picker stands in a plain form and posts its own value. */
  name?: string;
  onChange: (categoryId: string) => void;
  className?: string;
}) {
  const t = useMessages();
  const [made, setMade] = useState<Section[]>([]);
  const [naming, setNaming] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const all = [...sections, ...made];

  function create() {
    const wanted = title.trim();
    if (!wanted) return;
    startTransition(async () => {
      const result = await addCategory(wanted);
      if (!result.ok) {
        setError(result.error ?? t.errors.generic);
        return;
      }
      setMade((current) => [...current, { id: result.id, name: result.name }]);
      onChange(result.id);
      setTitle("");
      setNaming(false);
      setError(null);
    });
  }

  if (naming) {
    return (
      <div className={className}>
        <div className="flex items-center gap-1.5">
          <Input
            value={title}
            autoFocus
            maxLength={60}
            placeholder={t.forms.sectionPlaceholder}
            aria-label={t.forms.newSection}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                create();
              }
              if (event.key === "Escape") setNaming(false);
            }}
          />
          <button
            type="button"
            disabled={pending || !title.trim()}
            onClick={create}
            aria-label={t.forms.addSection}
            className="bg-brand rounded-control flex size-9 shrink-0 items-center justify-center text-[var(--brand-ink)] disabled:opacity-40"
          >
            {pending ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Check size={15} strokeWidth={2.5} />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setNaming(false);
              setError(null);
            }}
            aria-label={t.common.cancel}
            className="text-text-3 hover:bg-surface-3 hover:text-text rounded-control flex size-9 shrink-0 items-center justify-center"
          >
            <X size={15} />
          </button>
        </div>
        {error ? <p className="text-negative mt-1 text-sm">{error}</p> : null}
        {name ? <input type="hidden" name={name} value={value} /> : null}
      </div>
    );
  }

  return (
    <div className={className}>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <Select
        value={value}
        onChange={(event) => {
          if (event.target.value === "+") {
            setNaming(true);
            return;
          }
          onChange(event.target.value);
        }}
      >
        <option value="">{t.forms.noSection}</option>
        {all.map((section) => (
          <option key={section.id} value={section.id}>
            {section.name}
          </option>
        ))}
        <option value="+">＋ {t.forms.newSection}</option>
      </Select>
    </div>
  );
}
