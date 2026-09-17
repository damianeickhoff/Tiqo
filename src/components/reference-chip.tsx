"use client";

import { useState } from "react";
import Link from "next/link";
import { BookText } from "lucide-react";
import { TicketPeekDialog } from "@/components/ticket-peek";
import { ProjectPeekDialog } from "@/components/project-peek";
import type { ReferenceKind } from "@/lib/references";

/**
 * A reference, as it reads inside a sentence.
 *
 * Following one should not cost the thing you were reading — nearly every
 * reference is checked in passing ("is that the same fault?") rather than
 * navigated to. So a ticket or a project opens where you stand, with its own
 * dialog offering the way through.
 *
 * A mention of a person is a link: there is no "quick look" at somebody that is
 * shorter than their page, and the page is what you wanted anyway. So is a
 * document — a runbook is read, not glanced at, and a dialog you have to scroll
 * is worse than the page it is standing in front of.
 *
 * Two tones. In prose a reference is a chip, because it has to be picked out of
 * a paragraph of ordinary words. In the trail it is one named thing inside a
 * short sentence that is already about it, so a chip there is decoration —
 * weight is enough to say it can be opened.
 */
export function ReferenceChip({
  href,
  label,
  kind,
  tone = "chip",
}: {
  href: string;
  label: string;
  kind: ReferenceKind;
  tone?: "chip" | "plain";
}) {
  const [open, setOpen] = useState(false);

  const className =
    tone === "plain"
      ? "text-text font-semibold no-underline underline-offset-2 transition-colors hover:text-brand-deep hover:underline"
      : "bg-surface-3 text-text hover:text-brand-deep inline-flex items-center rounded-control px-1.5 py-0.5 font-mono text-[0.86em] font-medium no-underline transition-colors hover:bg-[var(--brand-tint)]";

  // A person and an asset are links rather than peeks: there is no quick look
  // at either that is shorter than the page, and the asset page is where the
  // open tickets are — which is the reason somebody followed the name.
  if (kind === "user" || kind === "asset") {
    return (
      <Link href={href} className={className}>
        {label}
      </Link>
    );
  }

  // A document wears a mark instead of a sigil. Its label is its title, which
  // is ordinary prose, so without something in front of it a reference to a
  // runbook is invisible in a sentence about the runbook.
  if (kind === "doc") {
    return (
      <Link
        href={href}
        className={
          tone === "plain"
            ? className
            : "bg-surface-3 text-text hover:text-brand-deep rounded-control inline-flex items-center gap-1 px-1.5 py-0.5 align-baseline text-[0.94em] font-medium no-underline transition-colors hover:bg-[var(--brand-tint)]"
        }
      >
        {tone === "plain" ? null : (
          <BookText size={12} aria-hidden className="shrink-0 translate-y-[1px]" />
        )}
        {label}
      </Link>
    );
  }

  // Still an anchor: middle-click, ctrl-click and "copy link" all have to keep
  // working, and a reference nobody can open in a tab is a worse reference.
  return (
    <>
      <a
        href={href}
        className={className}
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
          event.preventDefault();
          setOpen(true);
        }}
      >
        {label}
      </a>

      {open && kind === "ticket" ? (
        <TicketPeekDialog number={Number(href.split("/").pop())} onClose={() => setOpen(false)} />
      ) : null}
      {open && kind === "project" ? (
        <ProjectPeekDialog
          projectKey={href.split("/").pop() ?? ""}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
