"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Archive, Boxes, Clock, Star, Ticket, X } from "lucide-react";
import type { CiLifecycle } from "@/generated/prisma/enums";
import { deleteCiView, saveCiView } from "@/lib/actions/cmdb";
import type { CiView } from "@/lib/ci-views";
import { CiGlyph } from "@/components/cmdb/ci-glyph";
import { LIFE_TOKEN } from "@/components/cmdb/ci-lifecycle";
import { ViewsColumn, type ViewGroup } from "@/components/shell/views-column";
import { Input } from "@/components/ui";
import { useMessages } from "@/components/shell/instance-context";

export type SidebarType = {
  key: string;
  name: string;
  icon: string | null;
  color: string;
  count: number;
};

/** What each lifecycle holds in the type being stood in. The strip at the foot
 *  of the column is the one number a register has that a list of rows does
 *  not: how much of the estate is still alive. */
export type LifecycleCount = { lifecycle: CiLifecycle; count: number };

const BUILT_IN_ICON = { expiring: Clock, open: Ticket, retired: Archive };

const MAX_NAME = 40;

/**
 * The register's views column: the types first, then the questions.
 *
 * Which kind of thing you are looking at is not one filter among five, it is
 * the question you arrive with — and it is also what decides which columns the
 * table can even offer. Standing somewhere makes that obvious in a way a select
 * never did, so the types are the column's first group rather than a dropdown.
 *
 * Changing type drops the other filters on purpose. They are mostly per-type
 * anyway, and carrying a lifecycle filter into a type that has none of those
 * assets shows an empty page with no clue why.
 *
 * Under them, the questions rather than the things: three the app ships with
 * and whatever somebody has kept. A view is a URL, so standing in one is the
 * same act as standing in a type.
 *
 * The shape is the queue's and the project list's, because an overview page is
 * an overview page: it was this register's own 240px sidebar until the three
 * pages were given one column between them.
 */
export function CiViews({
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
  const router = useRouter();
  const params = useSearchParams();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  const current = params.get("type") ?? "";
  const view = params.get("view") ?? "";

  const total = types.reduce((sum, type) => sum + type.count, 0);
  const live = lifecycles.reduce((sum, row) => sum + row.count, 0);

  function save() {
    // What is being looked at, not where in it: the row that happened to be
    // open in the pane and which page of the list it was on are not part of
    // the question somebody is keeping.
    const kept = new URLSearchParams(params.toString());
    kept.delete("peek");
    kept.delete("page");
    startTransition(async () => {
      const result = await saveCiView(name, kept.toString());
      if (!result.ok) return;
      setName("");
      setNaming(false);
      router.refresh();
    });
  }

  const groups: ViewGroup[] = [
    {
      id: "types",
      heading: t.cmdb.types,
      items: [
        {
          id: "all",
          label: t.cmdb.allTypes,
          icon: <Boxes size={14} strokeWidth={2} />,
          count: total,
          href: "/cmdb",
          active: current === "" && !view,
        },
        ...types.map((type) => ({
          id: type.key,
          label: type.name,
          icon: <CiGlyph icon={type.icon} color={type.color} size={13} />,
          count: type.count,
          href: `/cmdb?type=${encodeURIComponent(type.key)}`,
          active: current === type.key && !view,
        })),
      ],
    },
    {
      id: "saved",
      heading: t.cmdb.savedViews,
      items: [
        ...(["expiring", "open", "retired"] as const).map((built) => {
          const Icon = BUILT_IN_ICON[built];
          return {
            id: built,
            label: t.cmdb.builtInView[built],
            icon: <Icon size={14} strokeWidth={2} />,
            count: builtInCounts[built] ?? 0,
            href: `/cmdb?view=${built}`,
            active: view === built,
          };
        }),
        ...views.map((kept) => ({
          id: kept.name,
          label: kept.name,
          icon: <Star size={14} strokeWidth={2} />,
          href: `/cmdb?${kept.query}`,
          active: false,
          action: <ForgetView name={kept.name} />,
        })),
      ],
    },
  ];

  return (
    <ViewsColumn
      label={t.cmdb.views}
      groups={groups}
      save={naming ? undefined : { label: t.cmdb.saveView, onSelect: () => setNaming(true) }}
      footer={
        <div className="px-2">
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
      }
    >
      {naming ? (
        <form
          className="mt-1 flex items-center gap-1 max-lg:shrink-0 lg:px-1"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim()) save();
          }}
        >
          <Input
            autoFocus
            value={name}
            maxLength={MAX_NAME}
            placeholder={t.cmdb.viewName}
            aria-label={t.cmdb.viewName}
            className="h-8 text-sm"
            onChange={(event) => setName(event.target.value)}
          />
          <button
            type="button"
            onClick={() => {
              setNaming(false);
              setName("");
            }}
            aria-label={t.common.cancel}
            disabled={pending}
            className="text-text-3 hover:text-text rounded-control shrink-0 p-1 transition-colors"
          >
            <X size={14} />
          </button>
        </form>
      ) : null}
    </ViewsColumn>
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
      className="text-text-3 hover:text-negative rounded-full p-1 transition-colors disabled:opacity-50"
    >
      <X size={12} strokeWidth={2.5} />
    </button>
  );
}
