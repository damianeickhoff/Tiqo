"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Stamp } from "lucide-react";
import { shortAge } from "@/lib/tickets";
import { useMessages } from "@/components/shell/instance-context";

/**
 * The one thing that has been waiting longest on this person's answer, as a
 * band under the bar in the brand colour — the same place and shape as a
 * notice, because to the person reading it that is what it is.
 *
 * A count beside a nav link is something you notice on the way past; a change
 * nobody can start because somebody has not clicked yes needs to be harder to
 * walk past than that. The oldest one rather than all of them: a list belongs
 * on the page this points at, and a banner that lists things is a page.
 *
 * It hides itself on that page — a banner telling you to go where you already
 * are is furniture.
 */
export function ApprovalBanner({
  waitingSince,
  title,
  reference,
}: {
  waitingSince: Date;
  title: string;
  reference: string;
}) {
  const t = useMessages();
  const pathname = usePathname();
  if (pathname.startsWith("/portal/approvals")) return null;
  // The front page says it in its own words, under the search rather than over
  // it: there it is one of the things addressed to this person, beside the
  // request the desk is waiting on, and the two belong together.
  if (pathname === "/portal") return null;

  return (
    <div className="portal-wrap mt-2">
      <div className="bg-brand text-brand-fg flex min-h-[52px] items-center gap-3 rounded-[14px] px-5 py-2 text-base">
        <Stamp size={16} className="shrink-0" aria-hidden />
        <p className="min-w-0 flex-1">
          <span className="font-semibold">
            {t.portal.approvalBanner(shortAge(waitingSince, undefined, t))}
          </span>
          <span className="ml-2 opacity-80">
            <span className="font-mono text-sm">{reference}</span> {title}
          </span>
        </p>
        <Link
          href="/portal/approvals"
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors hover:bg-[color-mix(in_oklab,var(--brand-fg)_20%,transparent)]"
          style={{ background: "color-mix(in oklab, var(--brand-fg) 12%, transparent)" }}
        >
          {t.portal.approvalBannerAction}
          <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}
