"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Plus, Settings2, Trash2 } from "lucide-react";
import { ConfirmDelete } from "@/components/confirm-delete";
import { createTemplate, deleteTemplate } from "@/lib/actions/change-templates";
import { Button, FieldError, FormError, Input } from "@/components/ui";
import { useMessages } from "@/components/shell/instance-context";

type Phase = { id: string; name: string };
type Template = {
  id: string;
  name: string;
  description: string | null;
  phases: Phase[];
  steps: { id: string }[];
};

/**
 * The standard changes a desk repeats.
 *
 * The list stays a list; a plan is configured on its own page, because it is a
 * small document — phases, steps, deadlines, who usually does what and what
 * waits for what — and none of that fits in a settings row.
 */
export function PlanManager({ templates }: { templates: Template[] }) {
  const t = useMessages();
  const [state, formAction] = useActionState(createTemplate, undefined);
  const errors = state?.errors ?? {};

  return (
    <div className="space-y-5">
      {templates.length === 0 ? (
        <p className="border-border text-text-3 rounded-card text-md border border-dashed px-4 py-8 text-center">
          {t.plan.noTemplates}
        </p>
      ) : (
        <ul className="space-y-3">
          {templates.map((template) => (
            <TemplateRow key={template.id} template={template} />
          ))}
        </ul>
      )}

      <form action={formAction} className="space-y-3 pt-4">
        <FormError>{errors.form}</FormError>

        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="label mb-1.5 block">{t.plan.newTemplate}</span>
            <Input name="name" placeholder={t.settings.name} maxLength={60} className="w-52" />
          </label>
          <label className="block flex-1">
            <span className="label mb-1.5 block">{t.plan.whatItCovers}</span>
            <Input name="description" maxLength={160} placeholder={t.common.optional} />
          </label>
          <AddButton />
        </div>

        <FieldError>{errors.name}</FieldError>
      </form>
    </div>
  );
}

function TemplateRow({ template }: { template: Template }) {
  const t = useMessages();

  return (
    <li className="card overflow-hidden">
      <div className="bg-surface-2 flex flex-wrap items-center gap-3 px-4 py-3">
        <span className="min-w-0 flex-1">
          <span className="text-md block font-semibold">{template.name}</span>
          {template.description ? (
            <span className="text-text-3 mt-0.5 block text-sm">{template.description}</span>
          ) : null}
        </span>

        <span className="tnum text-text-3 shrink-0 text-base">
          {template.phases.length > 0
            ? `${t.plan.phaseCount(template.phases.length)} · ${t.plan.stepCount(template.steps.length)}`
            : t.plan.stepCount(template.steps.length)}
        </span>

        <Link
          href={`/settings/plans/${template.id}`}
          className="text-text-2 hover:bg-surface-3 hover:text-text rounded-control flex shrink-0 items-center gap-1.5 px-2.5 py-1.5 text-base font-medium transition-colors"
        >
          <Settings2 size={14} />
          {t.plan.configure}
        </Link>

        <ConfirmDelete
          title={t.common.deleteThing(template.name)}
          run={() => deleteTemplate(template.id)}
        >
          {(ask) => (
            <button
              type="button"
              onClick={ask}
              aria-label={t.common.deleteThing(template.name)}
              className="text-text-3 hover:bg-negative/12 hover:text-negative rounded-control flex size-7 shrink-0 items-center justify-center transition-colors"
            >
              <Trash2 size={14} />
            </button>
          )}
        </ConfirmDelete>
      </div>
    </li>
  );
}

function AddButton() {
  const { pending } = useFormStatus();
  const t = useMessages();
  return (
    <Button type="submit" disabled={pending}>
      <Plus size={15} strokeWidth={2.5} />
      {pending ? t.common.adding : t.plan.addTemplate}
    </Button>
  );
}
