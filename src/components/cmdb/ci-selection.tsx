"use client";

import { createContext, useContext, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Download, Loader2, QrCode, X } from "lucide-react";
import { CI_LIFECYCLES } from "@/lib/cmdb";
import { updateCisInBulk } from "@/lib/actions/cmdb";
import { Button, buttonClass, FormError, Select } from "@/components/ui";
import { useMessages } from "@/components/shell/instance-context";

/**
 * Which rows are ticked, shared between the table and the bar above it.
 *
 * A context rather than props because the two ends are not in the same tree:
 * the table is drawn on the server, one checkbox per row, and the bar that acts
 * on them is a client component beside it. What travels between them is a set
 * of ids and nothing else.
 */
const Selection = createContext<{
  chosen: Set<string>;
  toggle: (id: string) => void;
  replace: (ids: string[]) => void;
} | null>(null);

export function CiSelectionProvider({ children }: { children: React.ReactNode }) {
  const [chosen, setChosen] = useState<Set<string>>(new Set());

  const value = useMemo(
    () => ({
      chosen,
      toggle: (id: string) =>
        setChosen((current) => {
          const next = new Set(current);
          if (!next.delete(id)) next.add(id);
          return next;
        }),
      replace: (ids: string[]) => setChosen(new Set(ids)),
    }),
    [chosen],
  );

  return <Selection.Provider value={value}>{children}</Selection.Provider>;
}

/** Null outside a register that offers selection, which is how the table knows
 *  not to draw the column at all. */
function useSelection() {
  return useContext(Selection);
}

const BOX = "size-3.5 cursor-pointer accent-[var(--brand)]";

/** The tick on one row. */
export function CiRowCheck({ id, label }: { id: string; label: string }) {
  const selection = useSelection();
  if (!selection) return null;

  return (
    <input
      type="checkbox"
      className={BOX}
      aria-label={label}
      checked={selection.chosen.has(id)}
      onChange={() => selection.toggle(id)}
    />
  );
}

/**
 * The tick in the heading: this page of the register, all or none.
 *
 * This page rather than the whole register on purpose. "All 1,400" is a press
 * somebody makes by accident and cannot see the consequences of; a screenful is
 * a selection they can read before they act on it.
 */
export function CiAllCheck({ ids, label }: { ids: string[]; label: string }) {
  const selection = useSelection();
  if (!selection) return null;

  const all = ids.length > 0 && ids.every((id) => selection.chosen.has(id));

  return (
    <input
      type="checkbox"
      className={BOX}
      aria-label={label}
      checked={all}
      onChange={() => selection.replace(all ? [] : ids)}
    />
  );
}

/**
 * What to do with the ones that are ticked.
 *
 * A draft with an Apply, not a pair of dropdowns that write as they are
 * touched: this is describing a change to several things at once, which is
 * exactly the case CLAUDE.md says must not save on change. Nothing happens
 * until the button is pressed, and the button says how many rows it will touch.
 */
export function CiBulkBar({ teams }: { teams: { id: string; name: string }[] }) {
  const t = useMessages();
  const router = useRouter();
  const selection = useSelection();
  const [lifecycle, setLifecycle] = useState("");
  const [teamId, setTeamId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!selection || selection.chosen.size === 0) return null;

  const ids = [...selection.chosen];

  /// Retiring a screenful is the one bulk change a desk makes often enough to
  /// want a button for, and it is the same write Apply makes — said once rather
  /// than picked out of a dropdown every time.
  function retire() {
    setError(null);
    startTransition(async () => {
      const result = await updateCisInBulk(ids, { lifecycle: "RETIRED" });
      if (!result.ok) {
        setError(result.error ?? t.errors.generic);
        return;
      }
      selection!.replace([]);
      router.refresh();
    });
  }

  function apply() {
    setError(null);
    startTransition(async () => {
      const result = await updateCisInBulk(ids, {
        ...(lifecycle ? { lifecycle } : {}),
        // An empty string is a real answer here — "nobody operates these" — so
        // the key is left out entirely when nothing was chosen rather than sent
        // as null.
        ...(teamId ? { teamId: teamId === "none" ? null : teamId } : {}),
      });
      if (!result.ok) {
        setError(result.error ?? t.errors.generic);
        return;
      }
      selection!.replace([]);
      setLifecycle("");
      setTeamId("");
      router.refresh();
    });
  }

  const query = ids.map((id) => encodeURIComponent(id)).join(",");

  return (
    // One bar at the foot of the screen rather than a strip above the table:
    // what is ticked is at the bottom of a list somebody has scrolled, and a bar
    // that scrolled away with the header was one they had to go back up to.
    <div className="bg-surface rounded-card fixed inset-x-4 bottom-4 z-30 mx-auto flex w-fit max-w-[calc(100%-2rem)] flex-wrap items-center gap-2 px-3 py-2 shadow-[var(--shadow-float)]">
      <span className="text-base font-medium">{t.cmdb.selected(ids.length)}</span>

      <Select
        value={lifecycle}
        aria-label={t.cmdb.lifecycle}
        onChange={(event) => setLifecycle(event.target.value)}
        className="h-8 w-auto"
      >
        <option value="">{t.cmdb.bulkLifecycle}</option>
        {CI_LIFECYCLES.map((life) => (
          <option key={life} value={life}>
            {t.cmdb.life[life]}
          </option>
        ))}
      </Select>

      <Select
        value={teamId}
        aria-label={t.cmdb.team}
        onChange={(event) => setTeamId(event.target.value)}
        className="h-8 w-auto"
      >
        <option value="">{t.cmdb.bulkTeam}</option>
        <option value="none">{t.cmdb.unset}</option>
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </Select>

      <Button type="button" size="sm" disabled={pending || (!lifecycle && !teamId)} onClick={apply}>
        {pending ? <Loader2 size={13} className="animate-spin" /> : null}
        {t.cmdb.bulkApply}
      </Button>

      <span aria-hidden className="bg-line mx-0.5 h-5 w-px" />

      {/* Three verbs on their own, which is why they are not behind Apply: each
          one is the whole of what it does, and none of them describes anything. */}
      <a href={`/api/cmdb/export?ids=${query}`} className={buttonClass("outline", "sm")}>
        <Download size={13} />
        {t.cmdb.exportSelected}
      </a>

      <Link href={`/cmdb/labels?ids=${query}`} className={buttonClass("outline", "sm")}>
        <QrCode size={13} />
        {t.cmdb.labels}
      </Link>

      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={retire}>
        <Archive size={13} />
        {t.cmdb.retire}
      </Button>

      <button
        type="button"
        onClick={() => selection.replace([])}
        className="text-text-3 hover:text-text flex items-center gap-1 px-1.5 text-sm transition-colors"
      >
        <X size={13} />
        {t.cmdb.bulkClear}
      </button>

      {error ? (
        <span className="w-full">
          <FormError>{error}</FormError>
        </span>
      ) : null}
    </div>
  );
}
