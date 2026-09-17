"use client";

import { useOptimistic, useTransition } from "react";
import { setAvatarVariant } from "@/lib/actions/admin";
import { AVATARS, AvatarArt } from "@/components/avatar";
import { cn } from "@/lib/utils";
import { useMessages } from "@/components/shell/instance-context";

/** The row of faces in the account menu. Picking one saves immediately. */
export function AvatarPicker({ current, name }: { current: number; name: string }) {
  const t = useMessages();
  const [pending, startTransition] = useTransition();
  const [chosen, setChosen] = useOptimistic(current);

  function pick(variant: number) {
    startTransition(async () => {
      setChosen(variant);
      await setAvatarVariant(variant);
    });
  }

  return (
    <div className={cn("border-border-soft border-b px-4 py-3", pending && "opacity-70")}>
      <p className="label mb-2">{t.nav.yourAvatar}</p>
      <div className="grid grid-cols-4 gap-1.5">
        {AVATARS.map((face, index) => {
          const on = chosen === index;
          return (
            <button
              key={index}
              type="button"
              onClick={() => pick(index)}
              aria-pressed={on}
              aria-label={t.people.avatarOption(index + 1, name)}
              className={cn(
                "overflow-hidden rounded-full ring-offset-2 ring-offset-[var(--surface)] transition-all",
                on ? "ring-brand ring-2" : "opacity-70 hover:opacity-100",
              )}
            >
              <AvatarArt face={face} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
