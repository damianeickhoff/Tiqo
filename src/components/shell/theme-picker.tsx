"use client";

import { useEffect, useRef, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { THEME_COOKIE, THEME_CHOICES, type ThemeChoice } from "@/lib/ui-preferences";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

const ICONS: Record<ThemeChoice, typeof Sun> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

/**
 * Light, dark, or whatever the machine says.
 *
 * The choice is applied to the document rather than sent to the server: every
 * token hangs off one attribute, so the change is instant and there is nothing
 * to wait for. The cookie is only so the *next* page load renders the right
 * theme server-side, which is what keeps a dark-mode user from being shown a
 * white page for a frame.
 *
 * Leaving it on "system" leaves the head script in charge, and that script goes
 * on following the machine for as long as the tab is open.
 */
export function ThemePicker({
  choice: initial,
  compact = false,
}: {
  /// Handed down from the server, which read the cookie. Reading it off the
  /// document instead made the first client render disagree with the HTML that
  /// came from the server — the server had no cookie to consult and always drew
  /// "System" active, and React rightly complained about the mismatch.
  choice: ThemeChoice;
  compact?: boolean;
}) {
  const t = useMessages();
  const [choice, setChoice] = useState<ThemeChoice>(initial);

  // Nothing is written on the way in: the element already carries what the
  // server decided, and a cookie set for a preference nobody expressed would be
  // a preference nobody expressed.
  const chosen = useRef(false);

  useEffect(() => {
    if (!chosen.current) return;

    const element = document.documentElement;
    // Every colour transition on the page would otherwise animate from the old
    // tokens to the new — a row mid-fade from black to white reads as broken.
    // Transitions are switched off for the frames the flip takes.
    element.dataset.themeSwitching = "";
    const release = requestAnimationFrame(() =>
      requestAnimationFrame(() => delete element.dataset.themeSwitching),
    );
    element.dataset.themeChoice = choice;
    element.dataset.theme =
      choice === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : choice;

    // A year, on the path everything shares. Not a session cookie: a theme that
    // forgets itself when the browser closes is not a preference.
    document.cookie = `${THEME_COOKIE}=${choice}; path=/; max-age=31536000; samesite=lax`;
    return () => cancelAnimationFrame(release);
  }, [choice]);

  function pick(next: ThemeChoice) {
    chosen.current = true;
    setChoice(next);
  }

  return (
    <div
      role="radiogroup"
      aria-label={t.settings.themeLabel}
      className={cn(
        "bg-surface-2 inline-flex items-center gap-0.5 rounded-full p-0.5",
        compact ? "" : "w-full",
      )}
    >
      {THEME_CHOICES.map((value) => {
        const Icon = ICONS[value];
        const active = choice === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => pick(value)}
            title={t.settings.themes[value]}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-full text-sm font-medium transition-colors",
              compact ? "size-7" : "h-7 flex-1",
              active
                ? "text-text bg-[var(--seg-on)] shadow-[0_1px_2px_rgba(9,9,11,0.1),0_0_0_1px_rgba(9,9,11,0.04)]"
                : "text-text-2 hover:text-text",
            )}
          >
            <Icon size={14} />
            {compact ? (
              <span className="sr-only">{t.settings.themes[value]}</span>
            ) : (
              t.settings.themes[value]
            )}
          </button>
        );
      })}
    </div>
  );
}
