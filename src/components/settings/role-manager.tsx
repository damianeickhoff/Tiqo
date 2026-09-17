"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Check, Lock, Pencil, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { ConfirmDelete } from "@/components/confirm-delete";
import {
  createRole,
  deleteRole,
  renameRole,
  setDefaultRole,
  updateRole,
} from "@/lib/actions/roles";
import { setUserRole } from "@/lib/actions/admin";
import { PERMISSIONS, PERMISSION_GROUPS } from "@/lib/permissions";
import { TogglePicker } from "@/components/toggle-picker";
import { Avatar } from "@/components/avatar";
import { Button, FieldError, FormError, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useMessages } from "@/components/shell/instance-context";

type Role = {
  id: string;
  name: string;
  description: string | null;
  isMaster: boolean;
  isDefault: boolean;
  permissions: string[];
  users: number;
};

export type Member = {
  id: string;
  name: string;
  email: string;
  avatarVariant: number;
  roleId: string;
};

export function RoleManager({ people, roles }: { people: Member[]; roles: Role[] }) {
  // Nobody can be role-less, so removing someone from a role means moving them
  // to the one new accounts land in.
  const fallback = roles.find((role) => role.isDefault) ?? null;
  const t = useMessages();
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {roles.map((role) => (
          <RoleCard
            key={role.id}
            role={role}
            people={people}
            fallback={fallback}
            expanded={open === role.id}
            onToggle={() => setOpen(open === role.id ? null : role.id)}
          />
        ))}
      </ul>

      {adding ? (
        <NewRoleForm onDone={() => setAdding(false)} />
      ) : (
        <Button variant="outline" onClick={() => setAdding(true)}>
          <Plus size={15} strokeWidth={2.5} />
          {t.settings.newRole}
        </Button>
      )}
    </div>
  );
}

function RoleCard({
  role,
  people,
  fallback,
  expanded,
  onToggle,
}: {
  role: Role;
  people: Member[];
  fallback: Role | null;
  expanded: boolean;
  onToggle: () => void;
}) {
  const t = useMessages();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [granted, setGranted] = useState(role.permissions);
  const [editingName, setEditingName] = useState(false);
  const [picking, setPicking] = useState(false);

  const members = people.filter((person) => person.roleId === role.id);
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description ?? "");

  const dirty =
    granted.length !== role.permissions.length ||
    granted.some((key) => !role.permissions.includes(key));

  function toggle(key: string) {
    setGranted((current) =>
      current.includes(key) ? current.filter((value) => value !== key) : [...current, key],
    );
  }

  function run(work: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await work();
      setError(result.ok ? null : (result.error ?? t.errors.generic));
    });
  }

  return (
    <li className="card overflow-hidden">
      <div className="bg-surface-2 flex flex-wrap items-center gap-3 px-4 py-3">
        {editingName ? (
          <span className="flex flex-1 flex-wrap items-center gap-2">
            <Input
              value={name}
              autoFocus
              maxLength={40}
              onChange={(event) => setName(event.target.value)}
              className="h-9 w-40"
              aria-label={t.settings.name}
            />
            <Input
              value={description}
              maxLength={120}
              placeholder={t.settings.whatItIsFor}
              onChange={(event) => setDescription(event.target.value)}
              className="h-9 min-w-[12rem] flex-1"
              aria-label={t.settings.whatItIsFor}
            />
            <button
              type="button"
              disabled={pending || !name.trim()}
              onClick={() =>
                run(async () => {
                  const result = await renameRole(role.id, name, description);
                  if (result.ok) setEditingName(false);
                  return result;
                })
              }
              className="bg-brand rounded-control flex size-8 items-center justify-center text-[var(--brand-ink)] disabled:opacity-40"
              aria-label={t.common.save}
            >
              <Check size={15} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={() => setEditingName(false)}
              className="text-text-3 hover:bg-surface-3 hover:text-text rounded-control flex size-8 items-center justify-center"
              aria-label={t.common.cancel}
            >
              <X size={15} />
            </button>
          </span>
        ) : (
          <>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-md font-semibold">{role.name}</span>
                {role.isMaster ? (
                  <span className="text-brand-deep inline-flex items-center gap-1 rounded-full bg-[var(--brand-tint)] px-2 py-0.5 text-xs font-semibold">
                    <Lock size={10} />
                    {t.settings.master}
                  </span>
                ) : null}
                {role.isDefault ? (
                  <span className="bg-surface-3 text-text-2 rounded-full px-2 py-0.5 text-xs font-medium">
                    {t.settings.newAccounts}
                  </span>
                ) : null}
              </span>
              {role.description ? (
                <span className="text-text-3 mt-0.5 block text-sm">{role.description}</span>
              ) : null}
            </span>

            <span className="tnum text-text-3 shrink-0 text-base">
              {t.settings.peopleCount(role.users)}
            </span>

            <span className="text-text-3 shrink-0 text-base">
              {role.isMaster
                ? t.settings.everyPermission
                : t.settings.permissionCount(role.permissions.length)}
            </span>

            {role.isMaster ? null : (
              <span className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setEditingName(true)}
                  aria-label={t.common.renameThing(role.name)}
                  className="text-text-3 hover:bg-surface-3 hover:text-text rounded-control flex size-7 items-center justify-center transition-colors"
                >
                  <Pencil size={14} />
                </button>
                <ConfirmDelete
                  title={t.common.deleteThing(role.name)}
                  run={async () => run(() => deleteRole(role.id))}
                >
                  {(ask) => (
                    <button
                      type="button"
                      onClick={ask}
                      aria-label={t.common.deleteThing(role.name)}
                      className="text-text-3 hover:bg-negative/12 hover:text-negative rounded-control flex size-7 items-center justify-center transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </ConfirmDelete>
              </span>
            )}

            <button
              type="button"
              onClick={onToggle}
              aria-expanded={expanded}
              className="text-text-2 hover:bg-surface-3 hover:text-text rounded-control shrink-0 px-2 py-1 text-base font-medium"
            >
              {expanded ? t.settings.hide : t.settings.permissions}
            </button>
          </>
        )}
      </div>

      {error ? (
        <p className="bg-negative/[0.06] text-negative px-4 py-2 text-sm font-medium">{error}</p>
      ) : null}

      {expanded ? (
        <div className="animate-fade space-y-4 px-4 py-4">
          {/* Who holds this role, and the way to hand it to someone else.
              Reachable from the person's own page too — but an admin setting up
              a role thinks in terms of the role, not of walking the directory
              one account at a time. */}
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="label">{t.settings.whoHasIt}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => setPicking(true)}
              >
                <Plus size={14} strokeWidth={2.5} />
                {t.settings.addPeople}
              </Button>
            </div>

            {members.length === 0 ? (
              <p className="text-text-3 text-base">{t.settings.nobodyHasIt}</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {members.map((person) => (
                  <li
                    key={person.id}
                    className="bg-surface flex items-center gap-2 rounded-full border border-transparent py-1 pr-1 pl-1.5 text-base shadow-[var(--highlight)]"
                  >
                    <Avatar name={person.name} variant={person.avatarVariant} size={20} />
                    <span className="font-medium">{person.name}</span>
                    {fallback && fallback.id !== role.id ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => setUserRole(person.id, fallback.id))}
                        aria-label={t.settings.moveOut(person.name, fallback.name)}
                        title={t.settings.moveOut(person.name, fallback.name)}
                        className="text-text-3 hover:bg-negative/12 hover:text-negative flex size-6 items-center justify-center rounded-full transition-colors"
                      >
                        <X size={13} />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {picking ? (
            <TogglePicker
              title={t.settings.addPeople}
              description={t.settings.addPeopleBlurb(role.name)}
              items={people.map((person) => ({
                id: person.id,
                label: person.name,
                hint: person.email,
                icon: <Avatar name={person.name} variant={person.avatarVariant} size={22} />,
              }))}
              selected={new Set(members.map((person) => person.id))}
              pending={pending}
              error={error}
              emptyText={t.common.noMatches}
              searchPlaceholder={t.people.search}
              onToggle={(id, next) => {
                // Taking someone out means giving them the default role: an
                // account cannot exist without one.
                const to = next ? role.id : fallback?.id;
                if (to) run(() => setUserRole(id, to));
              }}
              onClose={() => setPicking(false)}
            />
          ) : null}

          {role.isMaster ? (
            <p className="text-brand-deep rounded-control flex items-center gap-2 bg-[var(--brand-tint)] px-3 py-2.5 text-base">
              <ShieldCheck size={15} />
              {t.settings.masterBlurb}
            </p>
          ) : (
            <>
              {PERMISSION_GROUPS.map((group) => (
                <fieldset key={group}>
                  <legend className="label mb-2">{t.permissionGroups[group]}</legend>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {PERMISSIONS.filter((permission) => permission.group === group).map(
                      (permission) => {
                        const on = granted.includes(permission.key);
                        return (
                          <label
                            key={permission.key}
                            className={cn(
                              "rounded-control flex cursor-pointer gap-2.5 border px-3 py-2 transition-colors",
                              on
                                ? "border-brand/45 bg-[var(--brand-tint)]"
                                : "bg-surface hover:bg-surface-2 border-transparent shadow-[var(--highlight)]",
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() => toggle(permission.key)}
                              className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]"
                            />
                            <span className="min-w-0">
                              <span className="block text-base font-medium">
                                {t.permissions[permission.key].label}
                              </span>
                              {t.permissions[permission.key].hint ? (
                                <span className="text-text-3 mt-0.5 block text-sm">
                                  {t.permissions[permission.key].hint}
                                </span>
                              ) : null}
                            </span>
                          </label>
                        );
                      },
                    )}
                  </div>
                </fieldset>
              ))}

              <div className="flex flex-wrap items-center gap-3 pt-3">
                <Button
                  disabled={pending || !dirty}
                  onClick={() => run(() => updateRole(role.id, granted))}
                >
                  {pending ? t.common.saving : t.settings.savePermissions}
                </Button>

                {dirty ? (
                  <button
                    type="button"
                    onClick={() => setGranted(role.permissions)}
                    className="text-text-3 hover:text-text text-base"
                  >
                    {t.settings.reset}
                  </button>
                ) : null}

                {role.isDefault ? null : (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => setDefaultRole(role.id))}
                    className="text-text-3 hover:text-text ml-auto text-base disabled:opacity-50"
                  >
                    {t.settings.makeDefaultRole}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      ) : null}
    </li>
  );
}

function NewRoleForm({ onDone }: { onDone: () => void }) {
  const t = useMessages();
  const [state, formAction] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await createRole(prev, formData);
    if (!result?.errors) onDone();
    return result;
  }, undefined);
  const errors = state?.errors ?? {};

  return (
    <form action={formAction} className="animate-rise card space-y-4 p-4">
      <FormError>{errors.form}</FormError>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="label mb-1.5 block">{t.settings.name}</span>
          <Input name="name" autoFocus maxLength={40} className="w-44" />
        </label>
        <label className="block flex-1">
          <span className="label mb-1.5 block">{t.settings.whatItIsFor}</span>
          <Input name="description" maxLength={120} placeholder={t.common.optional} />
        </label>
      </div>
      <FieldError>{errors.name}</FieldError>

      <p className="text-text-3 text-base">{t.settings.roleStartsEmpty}</p>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          {t.common.cancel}
        </Button>
        <CreateButton />
      </div>
    </form>
  );
}

function CreateButton() {
  const { pending } = useFormStatus();
  const t = useMessages();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? t.common.creating : t.settings.createRole}
    </Button>
  );
}

type FormState = { errors?: Record<string, string> } | undefined;
