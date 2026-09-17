"use client";

import { useOptimistic, useTransition } from "react";
import { setSelfRegistration } from "@/lib/actions/settings";
import { cn } from "@/lib/utils";
import { useMessages } from "@/components/shell/instance-context";

export function SelfRegistrationToggle({ open }: { open: boolean }) {
  const t = useMessages();
  const [pending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useOptimistic(open);

  function toggle() {
    startTransition(async () => {
      setIsOpen(!isOpen);
      await setSelfRegistration(!isOpen);
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <p className="text-text-2 text-md">
        {isOpen ? t.settings.signUpsOpen : t.settings.signUpsClosed}
      </p>

      <button
        type="button"
        role="switch"
        aria-checked={isOpen}
        aria-label={t.settings.signUpsToggle}
        onClick={toggle}
        disabled={pending}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-60",
          isOpen ? "bg-brand" : "bg-surface-3",
        )}
      >
        <span
          className={cn(
            "bg-surface absolute top-1 size-5 rounded-full shadow-[var(--shadow-sm)] transition-[left] duration-200",
            isOpen ? "left-6" : "left-1",
          )}
        />
      </button>
    </div>
  );
}
