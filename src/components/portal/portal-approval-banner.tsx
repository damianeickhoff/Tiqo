"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Stamp } from "lucide-react";
import { shortAge } from "@/lib/tickets";
import { useMessages } from "@/components/shell/instance-context";

/**
 * The one thing that has been waiting longest on this person's answer, across
 * the top of the portal.
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

  return (
    <div className="callout-brand flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
      <Stamp size={16} className="text-brand-deep shrink-0" />
      <p className="min-w-0 flex-1">
        <span className="text-md font-semibold">
          {t.portal.approvalBanner(shortAge(waitingSince, undefined, t))}
        </span>
        <span className="text-text-2 ml-2 text-base">
          <span className="font-mono text-sm">{reference}</span> {title}
        </span>
      </p>
      <Link
        href="/portal/approvals"
        className="text-brand-deep shrink-0 text-base font-semibold hover:underline"
      >
        {t.portal.approvalBannerAction}
      </Link>
    </div>
  );
}
