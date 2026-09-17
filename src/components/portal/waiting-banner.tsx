import Link from "next/link";
import { ArrowRight, MessageSquare } from "lucide-react";
import { getMessages } from "@/lib/settings";
import { shortAge } from "@/lib/tickets";

/**
 * The desk has asked this person something and is waiting on the answer.
 *
 * The same nudge on the front page and on their list of requests: it is the
 * one thing on the portal that is addressed to them personally, and a person
 * who meets it in two places should meet the same object twice. A card with
 * the brand colour down its edge and a button in it, because it asks for
 * something the other cards do not.
 *
 * It lives apart from the rest of the kit because it reads the dictionary on
 * the server, and `@/lib/settings` is server-only: with it in `portal-pieces`
 * any client component that wanted a card from that file pulled server code
 * into the browser bundle, and the route it was on failed to build at all.
 */
export async function WaitingBanner({
  href,
  who,
  reference,
  title,
  since,
}: {
  href: string;
  who: string;
  reference: string;
  title: string;
  /// When the desk stopped the clock and started waiting on them.
  since: Date;
}) {
  const t = await getMessages();

  return (
    <Link
      href={href}
      className="pcard relative flex flex-wrap items-center gap-x-4 gap-y-2 overflow-hidden py-4 pr-[22px] pl-[28px] text-[14.5px] transition-shadow hover:shadow-[var(--shadow-md)]"
    >
      <span aria-hidden className="bg-brand absolute inset-y-0 left-0 w-1.5" />
      <span
        aria-hidden
        className="bg-brand text-brand-fg flex size-10 shrink-0 items-center justify-center rounded-full"
      >
        <MessageSquare size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="font-semibold">{t.portal.waitingFor(who.split(" ")[0] ?? who)}</span>{" "}
        <span className="font-mono text-[13px] underline underline-offset-[3px]">{reference}</span>
        <span className="text-text-2"> · {title}</span>
      </span>
      {/* How long they have been kept waiting, in the same mono the rest of
          the portal counts in. "Two days" is the part of this that makes
          somebody answer today. */}
      <span className="text-text-3 hidden shrink-0 font-mono text-xs whitespace-nowrap sm:block">
        {t.portal.longestWait(shortAge(since))}
      </span>
      <span className="bg-brand text-brand-fg inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-full px-3.5 text-base font-semibold">
        {t.portal.replyNow}
        <ArrowRight size={13} />
      </span>
    </Link>
  );
}
