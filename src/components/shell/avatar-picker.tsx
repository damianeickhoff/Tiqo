"use client";

import { useRef, useState, useTransition } from "react";
import { Trash2, Upload } from "lucide-react";
import { clearAvatarImage, setAvatarImage } from "@/lib/actions/admin";
import { Avatar, type AvatarFallback } from "@/components/avatar";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

/**
 * Your own face, in the account menu.
 *
 * It used to be a row of eight illustrated figures to choose between. A picture
 * of the actual person is better than the closest of eight cartoons, and a desk
 * that would rather not have photographs has the fallback setting for that.
 */
export function AvatarPicker({
  name,
  variant,
  image,
  fallback,
}: {
  name: string;
  variant: number;
  image: string | null;
  fallback: AvatarFallback;
}) {
  const t = useMessages();
  const [pending, startTransition] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);
  // Shown straight away from the chosen file, so the circle changes on the
  // click rather than on the round trip.
  const [preview, setPreview] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  function upload(file: File) {
    setProblem(null);
    setPreview(URL.createObjectURL(file));
    startTransition(async () => {
      const result = await setAvatarImage(file);
      if (!result.ok) {
        setPreview(null);
        setProblem(result.error);
      }
    });
  }

  const shown = preview ?? image;

  return (
    <div className={cn("border-border-soft border-b px-4 py-3", pending && "opacity-70")}>
      <p className="label mb-2">{t.nav.yourAvatar}</p>

      <div className="flex items-center gap-3">
        <Avatar name={name} variant={variant} image={shown} fallback={fallback} size={44} />

        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          <button
            type="button"
            disabled={pending}
            onClick={() => input.current?.click()}
            className="bg-surface text-text hover:bg-surface-2 rounded-control inline-flex h-8 items-center gap-1.5 px-2.5 text-sm font-medium shadow-[var(--highlight)] transition-colors"
          >
            <Upload size={13} />
            {shown ? t.nav.replacePhoto : t.nav.addPhoto}
          </button>

          {shown ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setPreview(null);
                  await clearAvatarImage();
                })
              }
              className="text-text-2 hover:bg-surface-2 hover:text-text rounded-control inline-flex h-8 items-center gap-1.5 px-2.5 text-sm font-medium transition-colors"
            >
              <Trash2 size={13} />
              {t.common.remove}
            </button>
          ) : null}
        </div>
      </div>

      {problem ? <p className="text-negative mt-2 text-sm font-medium">{problem}</p> : null}

      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Choosing the same file twice after a failure would otherwise do
          // nothing, because the picker holds on to the selection.
          event.target.value = "";
          if (file) upload(file);
        }}
      />
    </div>
  );
}
