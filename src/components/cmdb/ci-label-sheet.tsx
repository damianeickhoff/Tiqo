"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { Button, buttonClass } from "@/components/ui";
import { useMessages } from "@/components/shell/instance-context";

export type CiLabel = {
  id: string;
  name: string;
  typeName: string;
  /// The serial or the model — what somebody standing at the rack reads to
  /// check they are looking at the right box before they scan it.
  subtitle: string | null;
  url: string;
  /// The code itself, drawn by the server: the encoder is a server module and
  /// a label page is printed, not interacted with.
  path: string | null;
  size: number;
};

/**
 * Labels, laid out to be printed and stuck on things.
 *
 * Its own page rather than a dialog because it is a document: the browser's own
 * print is the only printing this app will ever do, and a page is the only
 * thing it can print. White regardless of the theme for the same reason — the
 * paper is white, and a dark-mode label is a black rectangle with a hole in it.
 */
export function CiLabelSheet({ labels, back }: { labels: CiLabel[]; back: string }) {
  const t = useMessages();

  return (
    <div className="mx-auto max-w-4xl px-5 py-6">
      <div className="mb-5 flex items-center gap-3 print:hidden">
        <Link href={back} className={buttonClass("outline", "sm")}>
          <ArrowLeft size={13} />
          {t.cmdb.title}
        </Link>
        <h1 className="text-lg font-semibold">{t.cmdb.labelSheet(labels.length)}</h1>
        <Button type="button" size="sm" className="ml-auto" onClick={() => window.print()}>
          <Printer size={13} />
          {t.cmdb.printLabel}
        </Button>
      </div>

      <p className="text-text-3 mb-4 text-base print:hidden">{t.cmdb.labelBlurb}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        {labels.map((label) => (
          <div
            key={label.id}
            className="flex items-center gap-3 rounded-lg border border-black/15 bg-white p-3 text-black"
            style={{ breakInside: "avoid" }}
          >
            {label.path ? (
              <svg
                viewBox={`0 0 ${label.size} ${label.size}`}
                width={88}
                height={88}
                role="img"
                aria-label={label.url}
                className="shrink-0"
              >
                <rect width={label.size} height={label.size} fill="#fff" />
                <path d={label.path} fill="#000" />
              </svg>
            ) : null}
            <div className="min-w-0">
              <p className="text-md truncate font-semibold">{label.name}</p>
              <p className="truncate text-sm text-black/60">{label.typeName}</p>
              {label.subtitle ? (
                <p className="truncate font-mono text-xs text-black/60">{label.subtitle}</p>
              ) : null}
              <p className="mt-1 truncate font-mono text-[10px] text-black/40">{label.url}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
