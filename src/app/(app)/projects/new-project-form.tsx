"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { createProject } from "@/lib/actions/admin";
import { Button, Field, FieldError, FormError, Input, Textarea } from "@/components/ui";
import { useMessages } from "@/components/shell/instance-context";

function Submit() {
  const t = useMessages();
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending} className="w-full">
      {pending ? t.common.creating : t.projects.createProject}
    </Button>
  );
}

export function NewProjectForm({ onCreated }: { onCreated?: () => void }) {
  const t = useMessages();
  const [state, formAction] = useActionState(createProject, undefined);
  const errors = state?.errors ?? {};

  // The action answers with an empty object when it worked, so a dialog holding
  // this form can close itself. Nothing happens without the callback, which is
  // how the form still works on a page of its own.
  const created = Boolean(state) && !state?.errors;
  useEffect(() => {
    if (created) onCreated?.();
  }, [created, onCreated]);

  return (
    <form action={formAction} className="space-y-4">
      <FormError>{errors.form}</FormError>

      <Field label={t.projects.keyLabel} htmlFor="key" hint={t.projects.keyHint}>
        <Input
          id="key"
          name="key"
          placeholder="SUP"
          maxLength={5}
          className="font-mono tracking-widest uppercase"
        />
        <FieldError>{errors.key}</FieldError>
      </Field>

      <Field label={t.projects.nameLabel} htmlFor="name">
        <Input id="name" name="name" placeholder="Service Desk" />
        <FieldError>{errors.name}</FieldError>
      </Field>

      <Field label={t.projects.descriptionLabel} htmlFor="description">
        <Textarea id="description" name="description" rows={3} />
      </Field>

      <Field label={t.projects.colourLabel} htmlFor="color">
        <input
          id="color"
          name="color"
          type="color"
          defaultValue="#febe2e"
          className="border-border bg-surface rounded-control h-10 w-full cursor-pointer border px-1"
        />
      </Field>

      <Submit />
    </form>
  );
}
