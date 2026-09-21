"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Pencil } from "lucide-react";
import { updateDocCare } from "@/lib/actions/docs";
import { REVIEW_INTERVALS, buildTree, flattenTree, subtreeIds } from "@/lib/docs";
import { PanelCard, PanelRow as Row, PanelValue } from "@/components/tickets/panel-card";
import { SaveBar, useDraft } from "@/components/settings/draft";
import { StillCorrectButton, RemindMeButton } from "@/components/docs/doc-actions";
import { Avatar } from "@/components/avatar";
import { Select } from "@/components/ui";
import { useDateFormat, useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

type Person = { id: string; name: string; avatarVariant?: number | null };
type Sibling = { id: string; title: string; parentId: string | null; position: number };

/**
 * Who answers for this page, how long it may go unconfirmed, and where it sits.
 *
 * Read first. Five facts somebody checks in passing — is this mine, when is it
 * due, when did anybody last vouch for it — and two things they can do about
 * it without reading a form. Changing any of it is a second act, behind
 * Change, and a draft with its own Save.
 *
 * Kept apart from the body on purpose: it is a different decision, usually made
 * by somebody else, and saving it must not write a revision — moving a page in
 * the tree is not an edit anybody would want to read back.
 */
export function DocCare({
  docId,
  ownerId,
  owner,
  reviewDays,
  reviewedAt,
  reviewDueAt,
  reviewIn,
  parentId,
  parentTitle,
  spaceId,
  spaces,
  people,
  siblings,
  canEdit,
  isStale,
  snoozedTo,
}: {
  docId: string;
  ownerId: string | null;
  owner: Person | null;
  reviewDays: number;
  /// When somebody last said the words were still right, and when that runs
  /// out. Both worked out on the server: a clock read while rendering on the
  /// client is a hydration mismatch waiting for midnight.
  reviewedAt: Date | null;
  reviewDueAt: Date | null;
  reviewIn: number | null;
  parentId: string | null;
  parentTitle: string | null;
  spaceId: string;
  /// Every shelf this page could stand on. Moving to another one takes the
  /// page's whole branch with it, which is why it sits here with the tree and
  /// not in the editor.
  spaces: { id: string; name: string }[];
  people: Person[];
  /// Every page on this shelf, so the parent list can be drawn as the tree it
  /// is rather than as a flat column of titles that repeat.
  siblings: Sibling[];
  canEdit: boolean;
  isStale: boolean;
  snoozedTo: Date | null;
}) {
  const t = useMessages();
  const router = useRouter();
  const [changing, setChanging] = useState(false);
  const day = useDateFormat({ day: "numeric", month: "short", year: "numeric" });

  const draft = useDraft({
    ownerId: ownerId ?? "",
    reviewDays,
    parentId: parentId ?? "",
    spaceId,
  });

  // Itself and everything under it: filing a page inside its own branch would
  // cut the branch off the tree. Refused in the action too — this only keeps it
  // out of the list, which is the half somebody can see.
  const options = useMemo(() => {
    const forbidden = subtreeIds(siblings, docId);
    return flattenTree(buildTree(siblings)).filter((node) => !forbidden.has(node.id));
  }, [siblings, docId]);

  const summary =
    draft.draft.reviewDays === reviewDays && draft.draft.ownerId !== (ownerId ?? "")
      ? t.docs.owner
      : undefined;

  return (
    <PanelCard
      title={t.docs.care}
      action={
        canEdit && !changing ? (
          <button
            type="button"
            onClick={() => setChanging(true)}
            className="text-text-3 hover:text-text inline-flex items-center gap-1 text-sm font-medium transition-colors"
          >
            <Pencil size={12} />
            {t.docs.change}
          </button>
        ) : undefined
      }
    >
      {changing ? (
        <>
          <div className="space-y-0.5 p-2">
            <Row label={t.docs.owner}>
              <Select
                value={draft.draft.ownerId}
                aria-label={t.docs.owner}
                onChange={(event) => draft.set({ ownerId: event.target.value })}
              >
                <option value="">{t.docs.noOwner}</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </Select>
            </Row>

            <Row label={t.docs.staleAfter}>
              <Select
                value={String(draft.draft.reviewDays)}
                aria-label={t.docs.staleAfter}
                onChange={(event) => draft.set({ reviewDays: Number(event.target.value) })}
              >
                {REVIEW_INTERVALS.map((days) => (
                  <option key={days} value={days}>
                    {days === 0 ? t.docs.neverStale : t.docs.reviewDays(days)}
                  </option>
                ))}
              </Select>
            </Row>

            <Row label={t.docs.space}>
              <Select
                value={draft.draft.spaceId}
                aria-label={t.docs.space}
                onChange={(event) => draft.set({ spaceId: event.target.value })}
              >
                {spaces.map((one) => (
                  <option key={one.id} value={one.id}>
                    {one.name}
                  </option>
                ))}
              </Select>
            </Row>

            <Row label={t.docs.parent}>
              <Select
                value={draft.draft.parentId}
                // A parent on the shelf the page is leaving is not a parent it
                // can keep, so the choice is closed until the move is saved.
                disabled={draft.draft.spaceId !== spaceId}
                aria-label={t.docs.parent}
                onChange={(event) => draft.set({ parentId: event.target.value })}
              >
                <option value="">{t.docs.topLevel}</option>
                {options.map((node) => (
                  <option key={node.id} value={node.id}>
                    {/* Depth as a prefix rather than as indentation: a native
                        option cannot be indented, and a flat list of titles
                        says nothing about where any of them sit. */}
                    {`${"— ".repeat(Math.min(node.depth, 4))}${node.title}`}
                  </option>
                ))}
              </Select>
            </Row>
          </div>

          <SaveBar
            draft={draft}
            variant="footer"
            summary={summary}
            onCancel={() => setChanging(false)}
            onSaved={() => setChanging(false)}
            save={(values) =>
              updateDocCare(docId, {
                ownerId: values.ownerId || null,
                reviewDays: values.reviewDays,
                parentId: values.parentId || null,
                spaceId: values.spaceId,
              }).then((result) => {
                // A page that has moved shelf has a new address, and the
                // browser is standing on the old one.
                if (result.ok && result.href) router.push(result.href);
                return {
                  ok: result.ok,
                  error: result.ok ? undefined : Object.values(result.errors)[0],
                };
              })
            }
          />
        </>
      ) : (
        <>
          <dl className="space-y-0.5 p-2">
            <Fact label={t.docs.owner}>
              {owner ? (
                <Value>
                  <Avatar name={owner.name} variant={owner.avatarVariant ?? 0} size={18} />
                  <span className="truncate">{owner.name}</span>
                </Value>
              ) : (
                <Value muted>{t.docs.noOwner}</Value>
              )}
            </Fact>

            {/* Said as the rule it is rather than as an interval: "review
                every 90 days" is a habit somebody may or may not have, and
                "stale after 90 days without confirmation" is what the desk
                will actually do about it. It is the only place the staleness
                setting is visible while reading a page. */}
            <Fact label={t.docs.staleAfter}>
              <Value wrap>
                {reviewDays === 0 ? t.docs.neverStale : t.docs.staleAfterDays(reviewDays)}
              </Value>
            </Fact>

            <Fact label={t.docs.lastConfirmed}>
              {reviewedAt ? (
                <Value className="tnum">{day.format(reviewedAt)}</Value>
              ) : (
                <Value muted>{t.docs.neverConfirmed}</Value>
              )}
            </Fact>

            <Fact label={t.docs.nextReview}>
              {reviewDueAt ? (
                <Value className="tnum">
                  {day.format(reviewDueAt)}
                  {reviewIn !== null ? (
                    // Short, because the date beside it is the fact and this is
                    // only how far away it is: the sentence version does not fit
                    // a rail, and truncating it says nothing.
                    <span className="tag ml-0.5 shrink-0">
                      {reviewIn < 0 ? t.docs.daysOver(-reviewIn) : t.docs.daysAway(reviewIn)}
                    </span>
                  ) : null}
                </Value>
              ) : (
                <Value muted>{t.docs.neverStale}</Value>
              )}
            </Fact>

            <Fact label={t.docs.parent}>
              {parentTitle ? <Value>{parentTitle}</Value> : <Value muted>{t.docs.topLevel}</Value>}
            </Fact>
          </dl>

          {canEdit ? (
            <div className="flex items-center gap-1.5 px-2 pt-1 pb-3">
              <StillCorrectButton docId={docId} className="flex-1 justify-center" />
              {/* Only where there is something to put off. On a page that is
                  not due, a reminder button is a control with no consequence. */}
              {isStale || (reviewIn !== null && reviewIn <= 14) ? (
                <RemindMeButton docId={docId} snoozedTo={snoozedTo} />
              ) : (
                <span className="text-text-3 flex flex-1 items-center justify-center gap-1.5 text-sm">
                  <Bell size={12} />
                  {t.docs.notDueYet}
                </span>
              )}
            </div>
          ) : null}
        </>
      )}
    </PanelCard>
  );
}

/**
 * The shared readout, a size down.
 *
 * These are facts checked in passing beside the page rather than the ticket's
 * own settings, and at the ticket's size they were shouting over the labels
 * that name them. Same weight and colour, so a value is still a value.
 */
function Value({ className, ...props }: React.ComponentProps<typeof PanelValue>) {
  return <PanelValue {...props} className={cn("text-sm", className)} />;
}

/** The same row as the ticket's, as a definition: this card is a list of
 *  facts about the page, and a `dl` is what that is. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-9 grid-cols-[78px_minmax(0,1fr)] items-center gap-2">
      <dt className="text-text-3 pl-2 text-sm">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
