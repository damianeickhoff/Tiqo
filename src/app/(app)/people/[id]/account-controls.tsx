"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { Power, ShieldCheck, Trash2 } from "lucide-react";
import { deleteUser, setUserActive, setUserRole } from "@/lib/actions/admin";
import { Select } from "@/components/ui";
import { useMessages } from "@/components/shell/instance-context";

type Role = { id: string; name: string; isMaster: boolean };

/**
 * The three things done *to* an account, kept together on the person's own page
 * and away from the directory: a role change is not a row-level tweak, and
 * seeing whose account it is while you change it is the point.
 *
 * Whether each control appears at all is decided on the server; the action
 * checks the same rules again, so this is convenience rather than security.
 */
export function AccountControls({
  userId,
  roleId,
  roles,
  isActive,
  canChangeRole,
  canDeactivate,
  deletable,
}: {
  userId: string;
  roleId: string;
  roles: Role[];
  isActive: boolean;
  canChangeRole: boolean;
  canDeactivate: boolean;
  /** False when the account has tickets or messages behind it. */
  deletable: boolean;
}) {
  const t = useMessages();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useOptimistic(roleId);
  const [active, setActive] = useOptimistic(isActive);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function run(work: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await work();
      setError(result.ok ? null : (result.error ?? t.errors.generic));
    });
  }

  if (!canChangeRole && !canDeactivate) return null;

  return (
    <div className="space-y-4">
      {canChangeRole ? (
        <label className="block">
          <span className="label mb-1.5 flex items-center gap-1.5">
            <ShieldCheck size={13} className="text-text-3" />
            {t.people.role}
          </span>
          <Select
            value={role}
            disabled={pending}
            aria-label={t.people.role}
            onChange={(event) => {
              const next = event.target.value;
              run(async () => {
                setRole(next);
                return setUserRole(userId, next);
              });
            }}
          >
            {roles.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </Select>
        </label>
      ) : null}

      {canDeactivate ? (
        <div className="border-border-soft space-y-2 border-t pt-4">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(async () => {
                setActive(!active);
                return setUserActive(userId, !active);
              })
            }
            className="border-border hover:border-text-3 rounded-control text-md inline-flex h-10 w-full items-center justify-center gap-2 border px-3 font-medium transition-colors disabled:opacity-50"
          >
            <Power size={15} className="text-text-3" />
            {active ? t.people.deactivate : t.people.reactivate}
          </button>
          <p className="text-text-3 text-sm">
            {active ? t.people.deactivateHint : t.people.reactivateHint}
          </p>

          {confirmingDelete ? (
            <div className="animate-rise border-negative/40 bg-negative/[0.06] rounded-control border p-3">
              <p className="text-negative text-base font-medium">{t.people.deleteConfirm}</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await deleteUser(userId);
                      if (result.ok) router.push("/people");
                      else setError(result.error ?? t.errors.generic);
                    })
                  }
                  className="bg-negative rounded-control px-3 py-1.5 text-base font-semibold text-white disabled:opacity-50"
                >
                  {t.common.delete}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="text-text-3 hover:text-text px-2 text-base"
                >
                  {t.common.cancel}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={!deletable}
              title={deletable ? undefined : t.people.deleteBlocked}
              onClick={() => setConfirmingDelete(true)}
              className="text-text-3 hover:text-negative disabled:hover:text-text-3 inline-flex items-center gap-1.5 text-base transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 size={13} />
              {t.people.deleteAccount}
            </button>
          )}
        </div>
      ) : null}

      {error ? <p className="text-negative text-sm font-medium">{error}</p> : null}
    </div>
  );
}
