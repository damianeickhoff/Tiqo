"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { UserPlus } from "lucide-react";
import { createUser } from "@/lib/actions/admin";
import type { FormState } from "@/lib/actions/auth";
import { Modal } from "@/components/modal";
import { useMessages } from "@/components/shell/instance-context";
import { Button, Field, FieldError, FormError, Input, Select } from "@/components/ui";

/** React resets an uncontrolled form once its action resolves, so a rejected
 *  submission has to hand back what was typed or the operator loses all of it. */
type CreateState = (FormState & { values?: Record<string, string> }) | undefined;

/**
 * Adding someone to the directory. An operator can create requesters and other
 * operators; only an admin sees the admin role in the list, which the action
 * re-checks — the select is a convenience, not the rule.
 */
export function NewPerson({
  roles,
  canGrantMaster,
}: {
  roles: { id: string; name: string; isMaster: boolean }[];
  canGrantMaster: boolean;
}) {
  const t = useMessages();
  const [open, setOpen] = useState(false);
  // Closing on success happens inside the action rather than in an effect
  // watching its result: this is the moment it succeeded, and there is nothing
  // to re-derive on later renders.
  const [state, formAction] = useActionState<CreateState, FormData>(async (prev, formData) => {
    const result = await createUser(prev, formData);
    if (!result?.errors) {
      setOpen(false);
      return undefined;
    }
    return {
      ...result,
      values: Object.fromEntries(
        [...formData.entries()].map(([key, value]) => [key, String(value)]),
      ),
    };
  }, undefined);
  const errors = state?.errors ?? {};
  const kept = state?.values ?? {};

  // A role you could not grant afterwards is not offered here either.
  const grantable = canGrantMaster ? roles : roles.filter((role) => !role.isMaster);
  const fallback = grantable.find((role) => !role.isMaster) ?? grantable[0];

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus size={15} strokeWidth={2.2} />
        {t.people.newPerson}
      </Button>

      {open ? (
        <Modal
          title={t.people.newPerson}
          description={t.people.newPersonBlurb}
          onClose={() => setOpen(false)}
        >
          <form action={formAction} className="space-y-5">
            <FormError>{errors.form}</FormError>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t.auth.firstName} htmlFor="new-firstName">
                <Input
                  id="new-firstName"
                  name="firstName"
                  defaultValue={kept.firstName ?? ""}
                  autoFocus
                  autoComplete="off"
                  aria-invalid={Boolean(errors.firstName)}
                />
                <FieldError>{errors.firstName}</FieldError>
              </Field>

              <Field label={t.auth.lastName} htmlFor="new-lastName">
                <Input
                  id="new-lastName"
                  name="lastName"
                  defaultValue={kept.lastName ?? ""}
                  autoComplete="off"
                  aria-invalid={Boolean(errors.lastName)}
                />
                <FieldError>{errors.lastName}</FieldError>
              </Field>

              <Field label={t.auth.email} htmlFor="new-email">
                <Input
                  id="new-email"
                  name="email"
                  defaultValue={kept.email ?? ""}
                  type="email"
                  autoComplete="off"
                  aria-invalid={Boolean(errors.email)}
                />
                <FieldError>{errors.email}</FieldError>
              </Field>

              <Field label={t.people.phone} htmlFor="new-phone">
                <Input
                  id="new-phone"
                  name="phone"
                  defaultValue={kept.phone ?? ""}
                  type="tel"
                  autoComplete="off"
                />
                <FieldError>{errors.phone}</FieldError>
              </Field>

              <Field label={t.people.company} htmlFor="new-company">
                <Input
                  id="new-company"
                  name="company"
                  defaultValue={kept.company ?? ""}
                  autoComplete="off"
                />
                <FieldError>{errors.company}</FieldError>
              </Field>

              <Field label={t.people.department} htmlFor="new-department">
                <Input
                  id="new-department"
                  name="department"
                  defaultValue={kept.department ?? ""}
                  autoComplete="off"
                />
                <FieldError>{errors.department}</FieldError>
              </Field>

              <Field label={t.ticket.function} htmlFor="new-jobTitle">
                <Input
                  id="new-jobTitle"
                  name="jobTitle"
                  defaultValue={kept.jobTitle ?? ""}
                  autoComplete="off"
                />
                <FieldError>{errors.jobTitle}</FieldError>
              </Field>

              <Field label={t.people.role} htmlFor="new-role">
                <Select
                  id="new-role"
                  name="roleId"
                  defaultValue={kept.roleId ?? fallback?.id ?? ""}
                >
                  {grantable.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </Select>
                <FieldError>{errors.roleId}</FieldError>
              </Field>
            </div>

            <Field
              label={t.people.initialPassword}
              hint={t.people.initialPasswordHint}
              htmlFor="new-password"
            >
              <Input
                id="new-password"
                name="password"
                defaultValue={kept.password ?? ""}
                type="text"
                autoComplete="off"
                aria-invalid={Boolean(errors.password)}
              />
              <FieldError>{errors.password}</FieldError>
            </Field>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {t.common.cancel}
              </Button>
              <CreateButton />
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}

function CreateButton() {
  const { pending } = useFormStatus();
  const t = useMessages();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? t.common.creating : t.people.createAccount}
    </Button>
  );
}
