"use client";

import { useOptimistic, useTransition } from "react";
import { updateAvatarFallback } from "@/lib/actions/settings";
import { Avatar, type AvatarFallback } from "@/components/avatar";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

const CHOICES: AvatarFallback[] = ["INITIALS", "SILHOUETTE"];

/**
 * What a person looks like before they upload a picture.
 *
 * A list-level choice rather than a draft: there is one setting, the answer is
 * visible in the two samples beside it, and a Save between picking and seeing
 * would only be in the way. Both samples are drawn by the real component, so
 * what is offered is what the roster will show.
 */
export function AvatarFallbackForm({
  current,
  sample,
}: {
  current: AvatarFallback;
  sample: string;
}) {
  const t = useMessages();
  const [pending, startTransition] = useTransition();
  const [chosen, setChosen] = useOptimistic(current);

  return (
    <div className={cn("flex flex-wrap gap-3", pending && "opacity-70")}>
      {CHOICES.map((choice) => {
        const on = chosen === choice;
        return (
          <button
            key={choice}
            type="button"
            aria-pressed={on}
            onClick={() =>
              startTransition(async () => {
                setChosen(choice);
                await updateAvatarFallback(choice);
              })
            }
            className={cn(
              "rounded-card flex min-w-[10rem] flex-1 items-center gap-3 border p-3 text-left transition-colors",
              on
                ? "border-brand/45 bg-[var(--brand-tint)]"
                : "bg-surface hover:bg-surface-2 border-transparent shadow-[var(--highlight)]",
            )}
          >
            <Avatar name={sample} fallback={choice} size={36} />
            <span className="min-w-0">
              <span className="text-md block font-medium">
                {choice === "INITIALS" ? t.settings.avatarInitials : t.settings.avatarSilhouette}
              </span>
              <span className="text-text-3 block text-sm">
                {choice === "INITIALS"
                  ? t.settings.avatarInitialsHint
                  : t.settings.avatarSilhouetteHint}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
