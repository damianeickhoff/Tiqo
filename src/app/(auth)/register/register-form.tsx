"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight } from "lucide-react";
import { register } from "@/lib/actions/auth";
import { Button, Field, FieldError, FormError, Input } from "@/components/ui";
import { messagesFor, type Messages } from "@/lib/i18n";

function Submit({ t }: { t: Messages }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="group w-full">
      {pending ? t.auth.creatingAccount : t.auth.createAccount}
      {pending ? null : (
        <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
      )}
    </Button>
  );
}

export function RegisterForm({ locale }: { locale: string }) {
  const t = messagesFor(locale);
  const [state, formAction] = useActionState(register, undefined);
  const errors = state?.errors ?? {};

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <FormError>{errors.form}</FormError>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t.auth.firstName} htmlFor="firstName">
          <Input
            id="firstName"
            name="firstName"
            autoComplete="given-name"
            autoFocus
            aria-invalid={Boolean(errors.firstName)}
            placeholder="Sam"
          />
          <FieldError>{errors.firstName}</FieldError>
        </Field>

        <Field label={t.auth.lastName} htmlFor="lastName">
          <Input
            id="lastName"
            name="lastName"
            autoComplete="family-name"
            aria-invalid={Boolean(errors.lastName)}
            placeholder="Support"
          />
          <FieldError>{errors.lastName}</FieldError>
        </Field>
      </div>

      <Field label={t.auth.email} htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          placeholder="you@company.com"
        />
        <FieldError>{errors.email}</FieldError>
      </Field>

      <Field label={t.auth.password} htmlFor="password" hint={t.people.initialPasswordHint}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.password)}
        />
        <FieldError>{errors.password}</FieldError>
      </Field>

      <Submit t={t} />
    </form>
  );
}
