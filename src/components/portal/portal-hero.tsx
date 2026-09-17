import Link from "next/link";
import { Check } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { PortalIcon } from "@/components/portal/portal-icon";
import { PortalSearch } from "@/components/portal/portal-search";
import { StatusRing } from "@/components/tickets/glyphs";
import { getMessages } from "@/lib/settings";
import type { TicketStatus } from "@/lib/tickets";

export type HeroCards = {
  /// The viewer's most recent request that is still running.
  open: {
    title: string;
    status: TicketStatus;
    /// Who has it, or null when nobody has picked it up yet.
    who: string | null;
    /// How long ago the desk last replied on it, or null when it has not.
    repliedAge: string | null;
    /// How far through its response target it is, 0..1.
    heat: number;
  } | null;
  /// The viewer's most recent settled request.
  resolved: { title: string } | null;
  /// The latest reply the desk sent them.
  reply: { who: string; avatarVariant: number; quote: string } | null;
};

/**
 * The front door: the brand colour as a field, the greeting and the search on
 * it, and three cards from the product floating on the right in place of an
 * illustration.
 *
 * The cards are the viewer's own when there is anything to show — their open
 * request, their last resolved one, the last thing the desk said to them — and
 * three examples when there is not. The examples are marked as such for a
 * screen reader only: to the eye they are what the product looks like, which
 * is what an illustration is for.
 */
export async function PortalHero({
  firstName,
  welcome,
  starts,
  desk,
  cards,
}: {
  firstName: string;
  welcome: string;
  /// Four quick starts under the search: the leading sections of the catalogue.
  starts: { slug: string; name: string; icon: string | null }[];
  /// The desk light line: whether it is open, and the sentence after the dot.
  desk: { open: boolean | null; line: string };
  cards: HeroCards;
}) {
  const t = await getMessages();
  const example = !cards.open && !cards.resolved && !cards.reply;

  const open = cards.open ?? {
    title: t.portal.exampleOpen,
    status: { id: "example", name: "", color: "var(--p-medium)", settles: false },
    who: null,
    repliedAge: null,
    heat: 0.62,
  };
  const resolved = cards.resolved ?? { title: t.portal.exampleResolved };
  const reply = cards.reply ?? {
    who: t.portal.exampleWho,
    avatarVariant: 3,
    quote: t.portal.exampleQuote,
  };

  return (
    <section className="portal-wrap mt-2">
      <div
        // The minimum height is the floating cards' business: they are absolute,
        // so a short welcome line would let the field close up around the copy
        // and leave the bottom card sitting on the shelf. 48 top + 330 of cards
        // + the 60 the shelf overlaps by, and room to breathe.
        className="relative rounded-[24px] px-6 pt-10 pb-12 sm:px-10 lg:px-16 lg:pt-[60px] lg:pb-[108px] xl:min-h-[460px]"
        style={{
          background: "linear-gradient(115deg, var(--brand) 0%, var(--brand-2) 100%)",
          color: "var(--brand-fg)",
          boxShadow: "0 30px 60px -30px rgba(9, 9, 11, 0.35)",
        }}
      >
        {/* The clipping belongs to the glow, not to the field: on the field it
            would also swallow the search results, which hang below by design. */}
        <div aria-hidden className="absolute inset-0 overflow-hidden rounded-[24px]">
          <div
            className="absolute -top-[160px] -right-[120px] size-[620px] rounded-full"
            style={{
              background:
                "radial-gradient(closest-side, rgba(255, 255, 255, 0.35), transparent 70%)",
            }}
          />
        </div>

        <div
          role="group"
          aria-label={example ? t.portal.exampleCard : undefined}
          // Not below xl: the copy runs to 620px and the cards need 520 more
          // beside it, so on a 1024 screen they would be drawn over the search.
          className="absolute top-12 right-16 z-[2] hidden h-[330px] w-[520px] text-[#0b0b0d] xl:block"
        >
          <div className="absolute top-[104px] left-0 w-[320px] -rotate-3 rounded-2xl bg-white px-[18px] py-4 text-[13.5px] shadow-[0_24px_48px_-16px_rgba(9,9,11,0.45),0_1px_2px_rgba(9,9,11,0.1)]">
            <p className="flex items-center gap-2 text-[14px] font-semibold">
              <StatusRing status={open.status} />
              <span className="truncate">{open.title}</span>
            </p>
            <p className="mt-1 text-[12.5px] text-[#55555e]">
              {cards.open
                ? [
                    open.who
                      ? t.portal.onIt(open.who.split(" ")[0] ?? open.who)
                      : t.portal.notPickedUp,
                    open.repliedAge ? t.portal.repliedAgo(open.repliedAge) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : t.portal.exampleOpenSub}
            </p>
            <span className="mt-3 block h-1.5 overflow-hidden rounded-[3px] bg-[#f1f1f4]">
              <span
                className="bg-p-medium block h-full rounded-[3px]"
                style={{ width: `${Math.round(Math.min(1, Math.max(0.04, open.heat)) * 100)}%` }}
              />
            </span>
          </div>

          <div className="absolute top-0 right-0 w-[220px] rotate-3 rounded-2xl bg-white px-4 py-3.5 text-[13.5px] shadow-[0_24px_48px_-16px_rgba(9,9,11,0.45),0_1px_2px_rgba(9,9,11,0.1)]">
            <p className="flex items-center gap-2 text-[14px] font-semibold">
              <span className="flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-[#dcfaef] text-[#0f9d6b]">
                <Check size={17} />
              </span>
              {t.portal.resolved}
            </p>
            <p className="mt-1 truncate text-[12.5px] text-[#55555e]">{resolved.title}</p>
          </div>

          <div className="absolute right-[10px] bottom-0 w-[290px] -rotate-[1.5deg] rounded-2xl bg-white px-4 py-3.5 text-[13.5px] shadow-[0_24px_48px_-16px_rgba(9,9,11,0.45),0_1px_2px_rgba(9,9,11,0.1)]">
            <p className="flex items-center gap-2 text-[14px] font-semibold">
              <Avatar name={reply.who} variant={reply.avatarVariant} size={24} />
              {reply.who}
            </p>
            <p className="mt-1 line-clamp-2 text-[12.5px] text-[#55555e]">{reply.quote}</p>
          </div>
        </div>

        <div className="relative z-[4] max-w-[620px]">
          <h1 className="text-[34px] leading-[1.05] font-semibold tracking-[-0.035em] sm:text-[46px]">
            {t.portal.greeting(firstName)}
          </h1>
          <p
            className="mt-3 max-w-[44ch] text-[17px]"
            style={{ color: "color-mix(in oklab, var(--brand-fg) 72%, transparent)" }}
          >
            {welcome}
          </p>

          <div className="mt-[30px]">
            <PortalSearch />
          </div>

          {starts.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {starts.map((start) => (
                <Link
                  key={start.slug}
                  href={`/portal/c/${start.slug}`}
                  className="inline-flex h-[34px] items-center gap-2 rounded-full px-3.5 text-[13.5px] font-medium transition-colors hover:bg-[color-mix(in_oklab,var(--brand-fg)_18%,transparent)]"
                  style={{ background: "color-mix(in oklab, var(--brand-fg) 10%, transparent)" }}
                >
                  <PortalIcon name={start.icon} size={14} />
                  {start.name}
                </Link>
              ))}
            </div>
          ) : null}

          <p
            className="mt-[26px] inline-flex items-center gap-2.5 text-[13.5px]"
            style={{ color: "color-mix(in oklab, var(--brand-fg) 72%, transparent)" }}
          >
            <span
              aria-hidden
              className="size-[9px] rounded-full"
              style={
                desk.open === false
                  ? { background: "color-mix(in oklab, var(--brand-fg) 35%, transparent)" }
                  : { background: "#0f9d6b", boxShadow: "0 0 0 3px rgba(15, 157, 107, 0.25)" }
              }
            />
            <span>
              <b className="font-semibold" style={{ color: "var(--brand-fg)" }}>
                {desk.open === false ? t.portal.deskClosed : t.portal.deskOpen}
              </b>
              {desk.line ? ` ${desk.line}` : ""}
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
