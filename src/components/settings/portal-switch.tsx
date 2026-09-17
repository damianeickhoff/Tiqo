"use client";

import { useState, useTransition } from "react";
import { setPortalOpen } from "@/lib/actions/settings";
import { Modal } from "@/components/modal";
import { Button, Textarea } from "@/components/ui";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

/**
 * The portal's front door, on the page that is about the portal.
 *
 * Opening is one click — there is nothing to explain about a service being
 * available. Closing asks why first, because the portal does not go dark when
 * it is shut: it keeps answering, with this sentence on it. A list-level
 * command rather than a draft, so it takes effect the moment it is confirmed.
 */
export function PortalSwitch({ open, reason }: { open: boolean; reason: string | null }) {
  const t = useMessages();
  const [pending, startTransition] = useTransition();
  const [asking, setAsking] = useState(false);
  const [why, setWhy] = useState(reason ?? "");
  const [error, setError] = useState<string | null>(null);

  function run(next: boolean, text: string) {
    startTransition(async () => {
      const result = await setPortalOpen(next, text);
      if (result.ok) {
        setAsking(false);
        setError(null);
      } else {
        setError(result.error ?? t.errors.generic);
      }
    });
  }

  return (
    <>
      <span className="flex items-center gap-2">
        <span className={cn("text-sm font-medium", open ? "text-text" : "text-text-3")}>
          {open ? t.forms.portalOpen : t.forms.portalClosed}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={open}
          aria-label={open ? t.forms.closePortal : t.forms.reopenPortal}
          disabled={pending}
          onClick={() => (open ? setAsking(true) : run(true, why))}
          className={cn(
            "relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-60",
            open ? "bg-brand" : "bg-surface-3",
          )}
        >
          <span
            className={cn(
              "bg-surface absolute top-0.5 size-4 rounded-full shadow-[var(--shadow-sm)] transition-[left] duration-200",
              open ? "left-[18px]" : "left-0.5",
            )}
          />
        </button>
      </span>

      {asking ? (
        <Modal
          title={t.forms.closeTitle}
          description={t.forms.closeBlurb}
          onClose={() => setAsking(false)}
        >
          <div className="space-y-4">
            <label className="block">
              <span className="label mb-1.5 block">{t.forms.closeReason}</span>
              <Textarea
                autoFocus
                rows={3}
                value={why}
                maxLength={300}
                placeholder={t.forms.closeReasonHint}
                onChange={(event) => setWhy(event.target.value)}
              />
            </label>

            {error ? <p className="text-negative text-base font-medium">{error}</p> : null}

            <div className="border-line flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="ghost" onClick={() => setAsking(false)}>
                {t.common.cancel}
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={pending || !why.trim()}
                onClick={() => run(false, why)}
              >
                {t.forms.closePortal}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
