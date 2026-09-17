"use client";

import { updateBrandColor } from "@/lib/actions/settings";
import { brandTokens } from "@/lib/brand";
import { Input } from "@/components/ui";
import { SaveBar, useDraft } from "@/components/settings/draft";
import { cn } from "@/lib/utils";
import { useMessages } from "@/components/shell/instance-context";

/** Colours worth having one click away. The first is the one Tiqo ships with. */
const PRESETS = [
  "#febe2e",
  "#f97316",
  "#e11d48",
  "#8b5cf6",
  "#2563eb",
  "#0ea5e9",
  "#10b981",
  "#334155",
];

export function BrandColorForm({ current }: { current: string }) {
  const t = useMessages();
  const draft = useDraft({ brandColor: current });
  const value = draft.draft.brandColor;

  // Preview from the same function the server renders with, so what the swatch
  // shows is exactly what saving will produce.
  const preview = brandTokens(value)?.light;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => draft.set({ brandColor: preset })}
            aria-label={t.settings.usePreset(preset)}
            aria-pressed={value.toLowerCase() === preset}
            className={cn(
              "size-8 rounded-full ring-offset-2 ring-offset-[var(--surface)] transition-all",
              value.toLowerCase() === preset
                ? "ring-text-3 ring-2"
                : "hover:scale-110 focus-visible:scale-110",
            )}
            style={{ background: preset }}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="label mb-1.5 block">{t.settings.hex}</span>
          <span className="flex items-center gap-2">
            {/* The native picker and the text field are two views of one value. */}
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#febe2e"}
              onChange={(event) => draft.set({ brandColor: event.target.value })}
              aria-label={t.settings.pickColour}
              className="bg-surface rounded-control h-11 w-12 cursor-pointer border border-transparent p-1 shadow-[var(--highlight)]"
            />
            <Input
              value={value}
              onChange={(event) => draft.set({ brandColor: event.target.value })}
              spellCheck={false}
              className="w-32 font-mono"
            />
          </span>
        </label>

        {preview ? (
          <span className="flex items-center gap-2">
            <span
              className="rounded-control text-md inline-flex h-11 items-center px-4 font-semibold"
              style={{ background: preview["--brand"], color: preview["--brand-ink"] }}
            >
              {t.settings.previewButton}
            </span>
            <span
              className="rounded-control text-md inline-flex h-11 items-center px-4 font-semibold"
              style={{ background: preview["--brand-tint"], color: preview["--brand-deep"] }}
            >
              {t.settings.previewTint}
            </span>
          </span>
        ) : null}
      </div>

      {/* The hero is where the colour is now used at full size, so it is what a
          preview has to show: the gradient, and whether the writing on it comes
          out ink or white. The small swatches above still answer the other two
          questions — the button, and the colour as text on a tint. */}
      {preview ? (
        <div>
          <span className="label mb-1.5 block">{t.settings.previewHero}</span>
          <div
            className="rounded-card flex flex-col justify-center gap-3 px-6 py-5"
            style={{
              background: `linear-gradient(115deg, ${preview["--brand"]} 0%, ${preview["--brand-2"]} 100%)`,
              color: preview["--brand-fg"],
            }}
          >
            <span className="text-xl leading-none font-semibold tracking-[-0.03em]">
              {t.settings.previewHeroGreeting}
            </span>
            <span className="flex items-center gap-2.5">
              <span className="text-md flex h-9 flex-1 items-center rounded-full bg-white px-4 text-[#8e8e99]">
                {t.settings.previewHeroLine}
              </span>
              <span
                className="inline-flex h-8 items-center rounded-full px-3 text-sm font-medium"
                style={{
                  background: `color-mix(in oklab, ${preview["--brand-fg"]} 12%, transparent)`,
                }}
              >
                {t.settings.previewButton}
              </span>
            </span>
          </div>
        </div>
      ) : null}

      <SaveBar
        draft={draft}
        label={t.settings.brandApply}
        save={(values) => updateBrandColor(values.brandColor)}
      />
    </div>
  );
}
