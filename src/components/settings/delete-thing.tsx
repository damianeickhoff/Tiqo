"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { Modal } from "@/components/modal";
import { useMessages } from "@/components/shell/instance-context";

/**
 * Deleting the thing you are looking at.
 *
 * It lives on the item rather than on the row in the library: a trash can in a
 * list is one mis-click from a form somebody else spent an afternoon on, and
 * the only person who can judge whether this one should go is the person who
 * has opened it and read it.
 */
export function DeleteThing({
  name,
  blurb,
  remove,
  back,
}: {
  name: string;
  /// What deleting it actually costs, said plainly before it happens.
  blurb: string;
  remove: () => Promise<{ ok: boolean; error?: string }>;
  /// Where to go once there is nothing left to look at.
  back: string;
}) {
  const t = useMessages();
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const result = await remove();
      if (!result.ok) {
        setError(result.error ?? t.errors.generic);
        return;
      }
      setAsking(false);
      router.push(back);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAsking(true)}
        title={t.common.deleteThing(name)}
        aria-label={t.common.deleteThing(name)}
        className="text-text-3 hover:bg-negative/12 hover:text-negative rounded-full p-1.5 transition-colors"
      >
        <Trash2 size={14} />
      </button>

      {asking ? (
        <Modal
          title={t.common.deleteThing(name)}
          description={blurb}
          onClose={() => setAsking(false)}
        >
          {error ? (
            <p className="bg-negative/[0.06] text-negative rounded-control mb-4 px-4 py-2 text-base font-medium">
              {error}
            </p>
          ) : null}

          <div className="border-border-soft flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="ghost" onClick={() => setAsking(false)}>
              {t.common.cancel}
            </Button>
            <button
              type="button"
              disabled={pending}
              onClick={run}
              className="bg-negative rounded-control text-md inline-flex h-10 items-center gap-1.5 px-4 font-semibold text-white disabled:opacity-50"
            >
              <Trash2 size={14} />
              {pending ? t.common.saving : t.common.delete}
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
