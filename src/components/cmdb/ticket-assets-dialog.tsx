"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { CircleAlert, Plus, X } from "lucide-react";
import { addTicketCi, removeTicketCi, searchCiItems, type CiCandidate } from "@/lib/actions/cmdb";
import type { TicketAsset } from "@/lib/ticket-assets";
import { CiGlyph } from "@/components/cmdb/ci-glyph";
import { Button, FormError, Input } from "@/components/ui";
import { Modal } from "@/components/modal";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

/**
 * Which assets a ticket is about.
 *
 * Behind a toolbar button rather than on the rail: the rail already carries six
 * cards, and this is a thing you consult rather than watch. What it says when
 * you open it is the payoff — not the list, but the line under each asset saying
 * what else is broken on it.
 *
 * Adding and removing take effect at once. There is no draft here: naming an
 * asset is a verb on its own.
 */
export function TicketAssetsDialog({
  ticketId,
  assets,
  canEdit,
  onClose,
}: {
  ticketId: string;
  assets: TicketAsset[];
  canEdit: boolean;
  onClose: () => void;
}) {
  const t = useMessages();
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CiCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!adding) return;
    let live = true;
    const timer = setTimeout(() => {
      searchCiItems(query).then((rows) => {
        if (live) setResults(rows);
      });
    }, 180);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [adding, query]);

  const onTicket = new Set(assets.map((asset) => asset.id));

  function add(itemId: string) {
    startTransition(async () => {
      const result = await addTicketCi(ticketId, itemId);
      if (!result.ok) setError(result.error ?? t.errors.generic);
      else setError(null);
    });
  }

  function remove(itemId: string) {
    startTransition(async () => {
      const result = await removeTicketCi(ticketId, itemId);
      if (!result.ok) setError(result.error ?? t.errors.generic);
      else setError(null);
    });
  }

  return (
    <Modal title={t.cmdb.assetsOnTicketTitle} onClose={onClose}>
      <div className="space-y-4">
        <FormError>{error ?? undefined}</FormError>

        {assets.length === 0 ? (
          <p className="text-text-3 text-base">{t.cmdb.noAssetsOnTicket}</p>
        ) : (
          <ul className="border-border rounded-card divide-line divide-y border">
            {assets.map((asset) => (
              <li key={asset.id} className="flex items-start gap-2.5 px-3 py-2.5">
                <CiGlyph icon={asset.type.icon} color={asset.type.color} size={14} />
                <div className="min-w-0 flex-1 leading-tight">
                  <Link
                    href={`/cmdb/${asset.id}`}
                    className={cn(
                      "block truncate text-base font-medium hover:underline",
                      asset.lifecycle === "RETIRED" && "opacity-55",
                    )}
                  >
                    {asset.name}
                  </Link>
                  <p className="text-text-3 truncate text-sm">{asset.type.name}</p>

                  {/* The one inference worth making, and the whole reason this
                      dialog is worth opening rather than a list of names. */}
                  {asset.alsoOpen > 0 ? (
                    <p className="text-negative mt-1 flex items-center gap-1.5 text-sm font-medium">
                      <CircleAlert size={12} strokeWidth={2.5} />
                      {t.cmdb.alsoOpen(asset.alsoOpen)}
                    </p>
                  ) : null}
                  {asset.nearby ? (
                    <p className="text-text-2 mt-1 flex items-center gap-1.5 text-sm">
                      <CircleAlert size={12} strokeWidth={2.5} />
                      {t.cmdb.alsoOpenNearby(asset.nearby.count, asset.nearby.name)}
                    </p>
                  ) : null}
                </div>

                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => remove(asset.id)}
                    disabled={pending}
                    aria-label={t.cmdb.removeAsset}
                    title={t.cmdb.removeAsset}
                    className="text-text-3 hover:bg-surface-3 hover:text-text rounded-control shrink-0 p-1 transition-colors disabled:opacity-50"
                  >
                    <X size={13} />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {canEdit && !adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-brand-deep flex items-center gap-1.5 text-base font-medium hover:underline"
          >
            <Plus size={14} strokeWidth={2.5} />
            {t.cmdb.addAsset}
          </button>
        ) : null}

        {canEdit && adding ? (
          <div className="space-y-2">
            <Input
              value={query}
              autoFocus
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.cmdb.searchItems}
              aria-label={t.cmdb.searchItems}
            />
            <div className="border-border rounded-card max-h-52 space-y-1 overflow-y-auto border p-1">
              {results.length === 0 ? (
                <p className="text-text-3 py-5 text-center text-base">{t.common.noMatches}</p>
              ) : (
                results.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    disabled={pending || onTicket.has(candidate.id)}
                    onClick={() => add(candidate.id)}
                    className="rounded-control hover:bg-surface-2 flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition-colors disabled:opacity-40"
                  >
                    <CiGlyph icon={candidate.type.icon} color={candidate.type.color} size={13} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-medium">{candidate.name}</span>
                      <span className="text-text-3 block truncate text-sm">
                        {candidate.type.name}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            {t.common.done}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
