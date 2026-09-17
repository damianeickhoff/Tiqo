"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { login } from "@/lib/actions/auth";
import { Button, Field, FieldError, FormError, Input } from "@/components/ui";
import { messagesFor, type Messages } from "@/lib/i18n";

function Submit({ t }: { t: Messages }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="group w-full">
      {pending ? t.auth.signingIn : t.auth.signIn}
      {pending ? null : (
        <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
      )}
    </Button>
  );
}

export function LoginForm({ locale, next }: { locale: string; next?: string }) {
  const t = messagesFor(locale);
  const [state, formAction] = useActionState(login, undefined);
  const [showing, setShowing] = useState(false);
  const errors = state?.errors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      {/* Where to land afterwards. The action only honours a path of its own,
          so this cannot become an open redirect. */}
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FormError>{errors.form}</FormError>

      <Field label={t.auth.email} htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          aria-invalid={Boolean(errors.email)}
          placeholder="you@company.com"
        />
        <FieldError>{errors.email}</FieldError>
      </Field>

      <Field label={t.auth.password} htmlFor="password">
        <span className="relative block">
          <Input
            id="password"
            name="password"
            type={showing ? "text" : "password"}
            autoComplete="current-password"
            aria-invalid={Boolean(errors.password)}
            className="pr-11"
          />
          {/* Typing a password you cannot see, into a field that may already be
              telling you it is wrong, is the moment people give up. */}
          <button
            type="button"
            onClick={() => setShowing((current) => !current)}
            aria-label={showing ? t.auth.hidePassword : t.auth.showPassword}
            aria-pressed={showing}
            className="text-text-2 hover:text-text rounded-control absolute top-1/2 right-0.5 flex size-11 -translate-y-1/2 items-center justify-center transition-colors"
          >
            {showing ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </span>
        <FieldError>{errors.password}</FieldError>
      </Field>

      <Submit t={t} />
    </form>
  );
}
