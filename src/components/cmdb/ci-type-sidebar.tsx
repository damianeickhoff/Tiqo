"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Archive, Boxes, Clock, Plus, Ticket, X } from "lucide-react";
import type { CiLifecycle } from "@/generated/prisma/enums";
import { deleteCiView, saveCiView } from "@/lib/actions/cmdb";
import type { CiView } from "@/lib/ci-views";
import { CiGlyph } from "@/components/cmdb/ci-glyph";
import { LIFE_TOKEN } from "@/components/cmdb/ci-lifecycle";
import { Input } from "@/components/ui";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

export type SidebarType = {
  key: string;
  name: string;
  icon: string | null;
  color: string;
  count: number;
};

/** What each lifecycle holds in the type being stood in. The strip at the foot
 *  of the sidebar is the one number a register has that a list of rows does
 *  not: how much of the estate is still alive. */
export type LifecycleCount = { lifecycle: CiLifecycle; count: number };

const BUILT_IN_ICON = { expiring: Clock, open: Ticket, retired: Archive };

/**
 * The types, as a list you stand in rather than a filter you set.
 *
 * A dropdown was the wrong shape for this: which kind of thing you are looking
 * at is not one filter among five, it is the question you arrive with — and it
 * is also what decides which columns the table can even offer. Standing
 * somewhere makes that obvious in a way a select never did.
 *
 * Changing type drops the other filters on purpose. They are mostly per-type
 * anyway, and carrying a lifecycle filter into a type that has none of those
 * assets shows an empty page with no clue why.
 *
 * Under them, the questions rather than the things: three the app ships with
 * and whatever somebody has kept. A view is a URL, so standing in one is the
 * same act as standing in a type.
 */
export function CiTypeSidebar({
  types,
  views,
  builtInCounts,
  lifecycles,
}: {
  types: SidebarType[];
  /// The views this person kept, newest last, as they were stored.
  views: CiView[];
  /// How many rows each shipped view holds right now. Counted by the page,
  /// because only it can ask the database.
  builtInCounts: Record<string, number>;
  lifecycles: LifecycleCount[];
}) {
  const t = useMessages();
  const params = useSearchParams();
  const current = params.get("type") ?? "";
  const view = params.get("view") ?? "";

  const total = types.reduce((sum, type) => sum + type.count, 0);
  const live = lifecycles.reduce((sum, row) => sum + row.count, 0);

  return (
    /* As tall as the register beside it, always: the strip at the foot of it is
       the shape of the estate, and a column of types that stops two thirds of
       the way down reads as a panel that failed to draw. */
    <nav
      aria-label={t.cmdb.type}
      className="border-line bg-chrome flex shrink-0 flex-col border-b p-2 lg:min-h-0 lg:w-[240px] lg:overflow-y-auto lg:border-r lg:border-b-0"
    >
      <ul className="flex gap-1 overflow-x-auto lg:block lg:space-y-0.5 lg:overflow-visible">
        <li>
          <Row href="/cmdb" on={current === "" && !view} label={t.cmdb.allTypes} count={total}>
            <span
              aria-hidden
              className="text-text-3 inline-flex size-[28px] shrink-0 items-center justify-center"
            >
              <Boxes size={15} strokeWidth={2} />
            </span>
          </Row>
        </li>

        {types.map((type) => (
          <li key={type.key}>
            <Row
              href={`/cmdb?type=${encodeURIComponent(type.key)}`}
              on={current === type.key && !view}
              label={type.name}
              count={type.count}
            >
              <CiGlyph icon={type.icon} color={type.color} size={13} />
            </Row>
          </li>
        ))}
      </ul>

      <p className="label mt-3 mb-1.5 px-2 max-lg:hidden">{t.cmdb.savedViews}</p>

      <ul className="flex gap-1 overflow-x-auto lg:block lg:space-y-0.5 lg:overflow-visible">
        {(["expiring", "open", "retired"] as const).map((name) => {
          const Icon = BUILT_IN_ICON[name];
          return (
            <li key={name}>
              <Row
                href={`/cmdb?view=${name}`}
                on={view === name}
                label={t.cmdb.builtInView[name]}
                count={builtInCounts[name] ?? 0}
              >
                <span
                  aria-hidden
                  className="text-text-3 inline-flex size-[28px] shrink-0 items-center justify-center"
                >
                  <Icon size={14} strokeWidth={2} />
                </span>
              </Row>
            </li>
          );
        })}

        {views.map((kept) => (
          <li key={kept.name} className="group/view relative">
            <Row
              href={`/cmdb?${kept.query}`}
              on={false}
              label={kept.name}
              count={null}
              className="pr-7"
            >
              <span
                aria-hidden
                className="text-text-3 inline-flex size-[28px] shrink-0 items-center justify-center"
              >
                <Clock size={14} strokeWidth={2} />
              </span>
            </Row>
            <ForgetView name={kept.name} />
          </li>
        ))}
      </ul>

      <SaveView />

      <div className="mt-auto px-2 pt-4 pb-1 max-lg:hidden">
        <p className="label mb-1.5">{t.cmdb.lifecycle}</p>
        {/* A bar rather than four numbers: the shape of the estate is the
            question — mostly in service with a tail of retired, or the other
            way round — and a shape is read faster than a column of counts. */}
        <div className="bg-surface-3 flex h-1.5 gap-px overflow-hidden rounded-full">
          {lifecycles.map((row) => (
            <i
              key={row.lifecycle}
              style={{ flex: row.count, background: `var(${LIFE_TOKEN[row.lifecycle]})` }}
              title={`${t.cmdb.life[row.lifecycle]} · ${row.count}`}
            />
          ))}
        </div>
        <p className="text-text-3 mt-1.5 text-xs">
          {live === 0
            ? t.cmdb.noLifecycles
            : lifecycles
                .filter((row) => row.count > 0)
                .map((row) => `${row.count} ${t.cmdb.life[row.lifecycle].toLowerCase()}`)
                .join(" · ")}
        </p>
      </div>
    </nav>
  );
}

/** Keeping the filters as they stand, under a name. A list-level command: it
 *  happens when it is pressed, and the only thing typed is what to call it. */
function SaveView() {
  const t = useMessages();
  const params = useSearchParams();
  const router = useRouter();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function save() {
    // What is being looked at, not where in it: the row that happened to be
    // open in the pane and which page of the list it was on are not part of
    // the question somebody is keeping.
    const kept = new URLSearchParams(params.toString());
    kept.delete("peek");
    kept.delete("page");
    const query = kept.toString();
    startTransition(async () => {
      const result = await saveCiView(name, query);
      if (!result.ok) return;
      setName("");
      setNaming(false);
      router.refresh();
    });
  }

  if (!naming) {
    return (
      <button
        type="button"
        onClick={() => setNaming(true)}
        className="text-text-3 hover:text-text rounded-control mt-0.5 flex items-center gap-2 px-2 py-1.5 text-sm font-medium transition-colors max-lg:hidden"
      >
        <span aria-hidden className="inline-flex size-[28px] shrink-0 items-center justify-center">
          <Plus size={14} strokeWidth={2.5} />
        </span>
        {t.cmdb.saveView}
      </button>
    );
  }

  return (
    <form
      className="mt-1 flex items-center gap-1 px-1 max-lg:hidden"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim()) save();
      }}
    >
      <Input
        autoFocus
        value={name}
        maxLength={40}
        placeholder={t.cmdb.viewName}
        aria-label={t.cmdb.viewName}
        className="h-8 text-sm"
        onChange={(event) => setName(event.target.value)}
      />
      <button
        type="button"
        onClick={() => setNaming(false)}
        aria-label={t.common.cancel}
        disabled={pending}
        className="text-text-3 hover:text-text rounded-control shrink-0 p-1 transition-colors"
      >
        <X size={14} />
      </button>
    </form>
  );
}

function ForgetView({ name }: { name: string }) {
  const t = useMessages();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await deleteCiView(name);
          router.refresh();
        })
      }
      aria-label={t.cmdb.forgetView(name)}
      title={t.cmdb.forgetView(name)}
      className="text-text-3 hover:text-negative absolute top-1/2 right-1 -translate-y-1/2 rounded-full p-1 opacity-0 transition-colors group-hover/view:opacity-100 focus-visible:opacity-100 disabled:opacity-50 max-lg:opacity-100"
    >
      <X size={12} strokeWidth={2.5} />
    </button>
  );
}

function Row({
  href,
  on,
  label,
  count,
  className,
  children,
}: {
  href: string;
  on: boolean;
  label: string;
  count: number | null;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      className={cn(
        "rounded-control flex items-center gap-2 px-2 py-1.5 text-base font-medium whitespace-nowrap transition-colors",
        on
          ? "text-brand-deep bg-[var(--brand-tint)]"
          : "text-text-2 hover:bg-surface-2 hover:text-text",
        className,
      )}
    >
      {children}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count === null ? null : (
        <span className="text-text-3 tnum shrink-0 font-mono text-xs">{count}</span>
      )}
    </Link>
  );
}
