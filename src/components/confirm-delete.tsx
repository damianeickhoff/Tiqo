"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { Modal } from "@/components/modal";
import { useMessages } from "@/components/shell/instance-context";

/**
 * Asking before something goes.
 *
 * Every deletion in the app is final — nothing here has an undo — so the moment
 * to change your mind is the only protection there is, and a bin icon that
 * takes effect on the way down gives none. What it deletes is named in the
 * title rather than described as "this item", because the whole point of the
 * question is to catch the row you did not mean to be on.
 *
 * The trigger is yours: the control that opens this sits in a toolbar here, a
 * hovered row there, a menu somewhere else, and each of them is already styled
 * for where it lives. This owns the asking, not the button.
 *
 * `DeleteThing` in `settings/` is the same idea for a whole page you are
 * standing on, and navigates away afterwards. This one stays put.
 */
export function ConfirmDelete({
  title,
  blurb,
  confirmLabel,
  run,
  children,
}: {
  /// What is about to go, by name.
  title: string;
  /// What it costs, when there is more to say than "there is no undo".
  blurb?: string;
  confirmLabel?: string;
  /// Actions that can refuse say so; the rest simply finish.
  run: () => Promise<{ ok: boolean; error?: string } | void>;
  children: (ask: () => void) => React.ReactNode;
}) {
  const t = useMessages();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await run();
      if (result && !result.ok) {
        setError(result.error ?? t.errors.generic);
        return;
      }
      setAsking(false);
    });
  }

  return (
    <>
      {children(() => {
        setError(null);
        setAsking(true);
      })}

      {asking ? (
        <Modal
          title={title}
          description={blurb ?? t.common.deleteBlurb}
          onClose={() => setAsking(false)}
        >
          {error ? (
            <p className="bg-negative/[0.06] text-negative rounded-control mb-4 px-4 py-2 text-base font-medium">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={() => setAsking(false)}>
              {t.common.cancel}
            </Button>
            <Button type="button" variant="dangerSolid" disabled={pending} onClick={confirm}>
              <Trash2 size={14} />
              {pending ? t.common.deleting : (confirmLabel ?? t.common.delete)}
            </Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
