"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Link2Off, Plus } from "lucide-react";
import type { CiLifecycle, CiRelationKind } from "@/generated/prisma/enums";
import { relateCis, searchCiItems, unrelateCis, type CiCandidate } from "@/lib/actions/cmdb";
import { CI_RELATION_KINDS } from "@/lib/cmdb";
import { CiGlyph } from "@/components/cmdb/ci-glyph";
import { Button, FieldError, FormError, Input, PickerRow, Select } from "@/components/ui";
import { PanelCard } from "@/components/tickets/panel-card";
import { Modal } from "@/components/modal";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

export type CiRelationRow = {
  id: string;
  kind: CiRelationKind;
  /// The whole of the difference between the two ends. The row is stored once,
  /// from the item it was made on, and the far end renders the inverse verb
  /// rather than getting a second row that could drift out of step with it.
  incoming: boolean;
  item: {
    id: string;
    name: string;
    lifecycle: CiLifecycle;
    type: { name: string; color: string; icon: string | null };
  };
};

/**
 * What this asset is connected to.
 *
 * A list with both readings, not a diagram. A topology picture is the thing
 * everybody asks for and nobody maintains; the two sentences either side of a
 * relation are what actually answers "if this goes, what goes with it".
 */
export function CiRelations({
  itemId,
  relations,
  canEdit,
}: {
  itemId: string;
  relations: CiRelationRow[];
  canEdit: boolean;
}) {
  const t = useMessages();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /// Outgoing first, then the inverse readings, each group in the order the
  /// connections were made.
  const ordered = [...relations].sort((a, b) => Number(a.incoming) - Number(b.incoming));

  function remove(id: string) {
    startTransition(async () => {
      const result = await unrelateCis(id);
      setError(result.ok ? null : (result.error ?? t.errors.generic));
    });
  }

  return (
    <PanelCard
      title={t.cmdb.related}
      className="h-fit"
      action={
        canEdit ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            aria-label={t.cmdb.relate}
            title={t.cmdb.relate}
            className="text-text-3 hover:bg-surface-3 hover:text-text rounded-control p-1 transition-colors"
          >
            <Plus size={14} />
          </button>
        ) : null
      }
    >
      {error ? (
        <div className="px-3.5 pt-3">
          <FormError>{error}</FormError>
        </div>
      ) : null}

      {relations.length === 0 ? (
        <p className="text-text-3 px-3.5 py-3 text-base">{t.cmdb.noRelations}</p>
      ) : (
        <ul className="divide-line divide-y">
          {ordered.map((relation, index) => (
            <li
              key={relation.id}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2",
                // What this asset says about other things, then a rule, then
                // what they say about it. The two readings are the same rows
                // seen from either end, and running them together makes a list
                // that reads as one sentence contradicting itself.
                relation.incoming && !ordered[index - 1]?.incoming && index > 0 && "border-t-2",
              )}
            >
              <CiGlyph icon={relation.item.type.icon} color={relation.item.type.color} size={13} />
              <div className="min-w-0 flex-1 leading-tight">
                <p className="text-text-3 text-xs">
                  {relation.incoming ? t.cmdb.inverse[relation.kind] : t.cmdb.verb[relation.kind]}
                </p>
                <Link
                  href={`/cmdb/${relation.item.id}`}
                  className={cn(
                    "block truncate text-sm font-medium hover:underline",
                    relation.item.lifecycle === "RETIRED" && "opacity-55",
                  )}
                >
                  {relation.item.name}
                </Link>
              </div>
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => remove(relation.id)}
                  disabled={pending}
                  aria-label={t.cmdb.removeRelation}
                  title={t.cmdb.removeRelation}
                  className="text-text-3 hover:bg-surface-3 hover:text-text rounded-control shrink-0 p-1 transition-colors disabled:opacity-50"
                >
                  <Link2Off size={13} />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {adding ? <RelateDialog itemId={itemId} onClose={() => setAdding(false)} /> : null}
    </PanelCard>
  );
}

function RelateDialog({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const t = useMessages();
  const [kind, setKind] = useState<CiRelationKind>("DEPENDS_ON");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CiCandidate[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  // Debounced: the search runs against the whole register, and a query per
  // character is a query per character.
  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      searchCiItems(query, itemId).then((rows) => {
        if (live) setResults(rows);
      });
    }, 180);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [itemId, query]);

  function add() {
    if (!chosen) return;
    startTransition(async () => {
      const result = await relateCis(itemId, { targetId: chosen, kind });
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      onClose();
    });
  }

  return (
    <Modal title={t.cmdb.relate} onClose={onClose}>
      <div className="space-y-4">
        <FormError>{errors.form}</FormError>

        <div className="flex items-center gap-2">
          <span className="label shrink-0">{t.cmdb.how}</span>
          <Select
            value={kind}
            onChange={(event) => setKind(event.target.value as CiRelationKind)}
            className="flex-1"
          >
            {CI_RELATION_KINDS.map((option) => (
              <option key={option} value={option}>
                {t.cmdb.verb[option]}
              </option>
            ))}
          </Select>
        </div>

        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.cmdb.searchItems}
          aria-label={t.cmdb.searchItems}
        />

        <div className="border-border rounded-card max-h-64 space-y-1 overflow-y-auto border p-1">
          {results.length === 0 ? (
            <p className="text-text-3 py-6 text-center text-base">{t.common.noMatches}</p>
          ) : (
            results.map((candidate) => (
              <PickerRow
                key={candidate.id}
                selected={chosen === candidate.id}
                aria-pressed={chosen === candidate.id}
                onClick={() => setChosen(candidate.id)}
                mono={false}
                lead={<CiGlyph icon={candidate.type.icon} color={candidate.type.color} size={13} />}
                title={candidate.name}
                hint={candidate.type.name}
              />
            ))
          )}
        </div>

        <FieldError>{errors.targetId}</FieldError>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button type="button" onClick={add} disabled={pending || !chosen}>
            {pending ? t.common.saving : t.cmdb.addAsset}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
