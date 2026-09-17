"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, FolderKanban, HelpCircle, User, Users, Wrench } from "lucide-react";
import type { TicketType } from "@/generated/prisma/enums";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

export type TypeCounts = {
  QUESTION: number;
  INCIDENT: number;
  CHANGE: number;
  total: number;
  project: number;
};

type Scope = "team" | "all" | "unassigned";

const ROWS: { kind: TicketType | "PROJECT"; icon: typeof Wrench }[] = [
  { kind: "INCIDENT", icon: AlertTriangle },
  { kind: "QUESTION", icon: HelpCircle },
  { kind: "CHANGE", icon: Wrench },
  { kind: "PROJECT", icon: FolderKanban },
];

/**
 * What there is to do, in one table.
 *
 * Kinds of work down the side, two counts across: what is on your name, and
 * whichever wider view you pick. Read as a grid rather than as two lists,
 * because the question is always a comparison — is this pile mine or somebody
 * else's — and a comparison needs both numbers on the same line.
 *
 * Split by kind of work rather than by status, because that is the split that
 * changes what you do next: an incident interrupts, a change is planned. And
 * projects are on it because they are work too, even though they are not
 * tickets — a desk that plans in projects should not have to go looking.
 */
export function QueueOverview({
  mine,
  team,
  all,
  unassigned,
  hasTeam,
}: {
  mine: TypeCounts;
  team: TypeCounts;
  all: TypeCounts;
  unassigned: TypeCounts;
  /// Whether this person is on any desk. It does not decide whether the group
  /// option exists — an option that vanishes reads as a bug, and somebody
  /// looking for "my groups" and not finding it has no way to learn why. It
  /// decides where the switch *starts*, and the menu says so.
  hasTeam: boolean;
}) {
  const t = useMessages();
  const [scope, setScope] = useState<Scope>(hasTeam ? "team" : "all");
  const [picking, setPicking] = useState(false);

  const scopes: { id: Scope; label: string; hint?: string }[] = [
    { id: "team", label: t.dashboard.scopeTeam, ...(hasTeam ? {} : { hint: t.dashboard.noDesk }) },
    { id: "all", label: t.dashboard.scopeAll },
    { id: "unassigned", label: t.dashboard.unassigned },
  ];
  const chosen = scopes.find((one) => one.id === scope) ?? scopes[0]!;
  /// The group view is the useful default, but only for somebody in a group.
  const resting: Scope = hasTeam ? "team" : "all";

  const wider = scope === "team" ? team : scope === "unassigned" ? unassigned : all;
  const query =
    scope === "team"
      ? "scope=team&open=1"
      : scope === "unassigned"
        ? "assignee=none&open=1"
        : "open=1";

  return (
    <table className="w-full border-collapse text-base">
      <caption className="sr-only">{t.dashboard.queueTable}</caption>
      <thead>
        <tr className="border-line bg-surface-2 border-b">
          <th scope="col" className="label px-4 py-2.5 text-left">
            {t.dashboard.tasks}
          </th>
          <th scope="col" className="w-[4.5rem] px-3 py-2.5">
            <span
              className="text-text-3 flex items-center justify-end"
              title={t.dashboard.onYourName}
            >
              <User size={15} />
              <span className="sr-only">{t.dashboard.onYourName}</span>
            </span>
          </th>
          {/* Two icons and nothing else, so the header stays as quiet as the
              screenshot it is modelled on. Which view the second column is
              showing lives on the button — its title, its tint and a tick in
              the menu — rather than taking a column's width to say so. */}
          <th scope="col" className="w-[4.5rem] px-3 py-2.5">
            <span className="relative flex items-center justify-end">
              <button
                type="button"
                onClick={() => setPicking((was) => !was)}
                aria-haspopup="menu"
                aria-expanded={picking}
                aria-label={`${t.dashboard.scope}: ${chosen.label}`}
                title={chosen.label}
                className={cn(
                  // Pulled right by half the padding its own box adds, so the
                  // glyph lands over the column of numbers rather than half a
                  // button to the left of them.
                  "rounded-control -mr-1.5 flex size-7 items-center justify-center transition-colors",
                  scope === resting
                    ? "text-text-3 hover:bg-surface-3 hover:text-text"
                    : "text-brand-deep bg-[var(--brand-tint)]",
                )}
              >
                <Users size={15} />
              </button>

              {picking ? (
                <>
                  <button
                    type="button"
                    aria-hidden
                    tabIndex={-1}
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setPicking(false)}
                  />
                  <span
                    role="menu"
                    className="animate-rise bg-surface rounded-control absolute top-full right-0 z-50 mt-1 min-w-[14rem] overflow-hidden p-1 text-left shadow-[var(--shadow-float)]"
                  >
                    {scopes.map((one) => (
                      <button
                        key={one.id}
                        type="button"
                        role="menuitemradio"
                        aria-checked={one.id === scope}
                        onClick={() => {
                          setScope(one.id);
                          setPicking(false);
                        }}
                        className="hover:bg-surface-2 rounded-control flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-base font-medium transition-colors"
                      >
                        <Check
                          size={13}
                          className={cn(
                            "shrink-0",
                            one.id === scope ? "text-brand-deep" : "opacity-0",
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate">{one.label}</span>
                        {one.hint ? (
                          <span className="text-text-3 shrink-0 text-xs font-normal">
                            {one.hint}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </span>
                </>
              ) : null}
            </span>
          </th>
        </tr>
      </thead>

      <tbody className="divide-border-soft divide-y">
        {ROWS.map(({ kind, icon: Icon }) => {
          const project = kind === "PROJECT";
          return (
            <tr key={kind} className="hover:bg-surface-2 transition-colors">
              <th scope="row" className="px-4 py-2 text-left font-normal">
                <span className="flex items-center gap-2.5">
                  <Icon size={14} className="text-text-3 shrink-0" />
                  {project ? t.nav.projects : t.vocab.type[kind]}
                </span>
              </th>

              <Count
                value={project ? mine.project : mine[kind]}
                href={project ? "/projects" : `/tickets?assignee=me&open=1&type=${kind}`}
                tone="brand"
              />
              <Count
                value={project ? wider.project : wider[kind]}
                href={project ? "/projects" : `/tickets?${query}&type=${kind}`}
              />
            </tr>
          );
        })}
      </tbody>

      <tfoot>
        <tr className="border-line border-t">
          <th scope="row" className="label px-4 py-2.5 text-left">
            {t.dashboard.everything}
          </th>
          <Count value={mine.total} href="/tickets?assignee=me&open=1" tone="brand" strong />
          <Count value={wider.total} href={`/tickets?${query}`} strong />
        </tr>
      </tfoot>
    </table>
  );
}

/** One cell: a number that is a link, or a plain zero where there is nothing. */
function Count({
  value,
  href,
  tone = "neutral",
  strong = false,
}: {
  value: number;
  href: string;
  tone?: "brand" | "neutral";
  strong?: boolean;
}) {
  return (
    <td className="px-3 py-2 text-right">
      {value === 0 ? (
        // A zero is not worth a click, and a column of coloured zeros makes the
        // numbers that matter harder to find.
        <span className="tnum text-text-3">0</span>
      ) : (
        <Link
          href={href}
          className={cn(
            "tnum font-semibold transition-colors",
            strong ? "text-md" : "text-md",
            tone === "brand"
              ? "text-brand-deep hover:underline"
              : "text-text hover:text-brand-deep",
          )}
        >
          {value}
        </Link>
      )}
    </td>
  );
}
