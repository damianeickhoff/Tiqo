import { DEFAULT_CLOCK } from "@/lib/tickets";
import { messagesFor } from "@/lib/i18n";
import { InstanceProvider } from "@/components/shell/instance-context";
import { Logo } from "@/components/shell/logo";
import { SignalField } from "@/components/shell/signal-field";
import { ThemePicker } from "@/components/shell/theme-picker";
import type { ThemeChoice } from "@/lib/ui-preferences";

/**
 * The door, for everyone.
 *
 * One canvas behind /login, /register and the portal's own way in, because they
 * are three doors into one instance. Two panes: on the left the product's own
 * graphic — a queue of tickets rising toward their response target, drawn from
 * the same bars as the mark — and on the right the form on a plain ground. The
 * left pane is dark in both themes: it is the brand's panel, not the page's.
 */
export function AuthCanvas({
  locale,
  theme,
  title,
  blurb,
  children,
  footer,
}: {
  /// So the one client control on the page speaks the instance's language.
  /// There is no shell out here to have set it up already.
  locale: string;
  /// The signed-out pages have no shell to have read this, so the page hands
  /// it in from the cookie.
  theme: ThemeChoice;
  title: string;
  blurb?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const t = messagesFor(locale);

  return (
    <InstanceProvider clock={DEFAULT_CLOCK} locale={locale}>
      <div className="bg-bg grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
        <aside
          className="relative flex flex-col overflow-hidden px-6 py-6 text-[#fafafa] lg:px-12 lg:py-10"
          style={{
            background: "#09090b",
            // The field reads its hues from the tokens; on this always-dark
            // panel they are pinned to the dark set whatever the theme.
            ["--p-low" as string]: "#34d399",
            ["--p-medium" as string]: "#818cf8",
            ["--p-high" as string]: "#fb923c",
            ["--p-urgent" as string]: "#fb7185",
            ["--brand" as string]: "var(--brand, #febe2e)",
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(60% 50% at 50% 100%, color-mix(in oklab, var(--brand) 16%, transparent), transparent 70%)",
            }}
          />

          <div className="relative flex items-center">
            <Logo size={28} />
          </div>

          <div className="relative mt-8 max-w-[34rem] lg:mt-14">
            <p className="text-2xl leading-[1.05] font-semibold tracking-[-0.03em] text-balance sm:text-3xl">
              {t.auth.tagline}
            </p>
            <p className="text-md mt-4 max-w-[40ch] leading-relaxed text-[#a1a1aa]">
              {t.auth.taglineBody}
            </p>
          </div>

          {/* The field takes the rest of the panel and fades out at the foot,
              so the copy above it stays the thing you read. */}
          <div className="relative mt-8 hidden min-h-[240px] flex-1 items-end lg:flex">
            <SignalField bars={48} height="100%" target={0.66} label={t.ticket.responseTarget} />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-24"
              style={{ background: "linear-gradient(180deg, transparent, #09090b)" }}
            />
          </div>
        </aside>

        <main className="relative flex items-center justify-center px-5 py-12 sm:px-8">
          <div className="absolute top-5 right-5">
            <ThemePicker choice={theme} compact />
          </div>

          <div className="w-full max-w-[380px]">
            <h1 className="text-2xl leading-tight font-semibold tracking-[-0.025em]">{title}</h1>
            {blurb ? (
              <p className="text-text-2 text-md mt-1.5 max-w-[40ch] leading-relaxed">{blurb}</p>
            ) : null}

            <div className="mt-7">{children}</div>

            {footer ? (
              <div className="border-line mt-7 border-t pt-5 text-center">{footer}</div>
            ) : null}
          </div>
        </main>
      </div>
    </InstanceProvider>
  );
}
