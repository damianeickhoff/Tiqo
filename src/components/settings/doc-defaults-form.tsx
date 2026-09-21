"use client";

import { updateDocDefaults } from "@/lib/actions/docs";
import type { DocReviewDefaults } from "@/lib/doc-sweep";
import { SaveBar, useDraft } from "@/components/settings/draft";
import { Field, Select } from "@/components/ui";
import { useMessages } from "@/components/shell/instance-context";

/** How long before the date the first notice goes. Zero waits for the lapse
 *  itself, which is the honest setting for a desk that does not want warnings. */
const BEFORE = [0, 3, 7, 14, 30];

/** And how often it repeats while nobody answers. Zero says it once. */
const AGAIN = [0, 7, 14, 30];

/**
 * How hard the desk chases a review.
 *
 * One draft with one Save, because the four answers are one decision: a desk
 * that warns a fortnight early and then never again has chosen something quite
 * different from one that warns on the day and repeats weekly, and choosing
 * them one field at a time hides that.
 */
export function DocDefaultsForm({
  defaults,
  /// Whether anything can call the poll route at all. Read on the server, from
  /// the environment, because the four settings below are promises this app
  /// keeps only when something outside it is running on a clock.
  polled,
}: {
  defaults: DocReviewDefaults;
  polled: boolean;
}) {
  const t = useMessages();
  const draft = useDraft(defaults);

  return (
    <div className="space-y-4">
      {/* What "stale" is, said once above the settings that act on it. The
          rule itself was configurable in three places and stated in none, so
          the chasing below read as a schedule with no subject. */}
      <p className="text-text-2 text-sm leading-relaxed">{t.docs.staleExplainer}</p>

      {/* Where the notices actually come from. Configuring a reminder rhythm
          on an instance nothing is polling produces no reminder at all, and
          the only place that was written down was the mail section of the
          README — which is not where anybody setting this up would look. */}
      {polled ? (
        <p className="text-text-3 text-sm leading-relaxed">{t.docs.remindersNeedPoll}</p>
      ) : (
        <p className="callout-brand text-brand-deep px-3 py-2 text-sm leading-relaxed">
          {t.docs.remindersNoPoll}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.docs.remindOwner} hint={t.docs.remindOwnerHint} htmlFor="doc-remind">
          <Select
            id="doc-remind"
            value={String(draft.draft.remindDays)}
            onChange={(event) => draft.set({ remindDays: Number(event.target.value) })}
          >
            {BEFORE.map((days) => (
              <option key={days} value={days}>
                {days === 0 ? t.docs.onTheDay : t.docs.daysBefore(days)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t.docs.thenWhat} htmlFor="doc-again">
          <Select
            id="doc-again"
            value={String(draft.draft.remindEveryDays)}
            onChange={(event) => draft.set({ remindEveryDays: Number(event.target.value) })}
          >
            {AGAIN.map((days) => (
              <option key={days} value={days}>
                {days === 0 ? t.docs.onceOnly : t.docs.everyDaysUntil(days)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t.docs.escalateTo} hint={t.docs.escalateHint} htmlFor="doc-escalate">
          <Select
            id="doc-escalate"
            value={draft.draft.escalateToTeam ? "team" : "nobody"}
            onChange={(event) => draft.set({ escalateToTeam: event.target.value === "team" })}
          >
            <option value="nobody">{t.docs.escalateNobody}</option>
            <option value="team">{t.docs.escalateTeam}</option>
          </Select>
        </Field>

        <Field label={t.docs.editingAPage} hint={t.docs.editingAPageHint} htmlFor="doc-edit-review">
          <Select
            id="doc-edit-review"
            value={draft.draft.editCountsAsReview ? "counts" : "ask"}
            onChange={(event) => draft.set({ editCountsAsReview: event.target.value === "counts" })}
          >
            <option value="counts">{t.docs.editCounts}</option>
            <option value="ask">{t.docs.editAsks}</option>
          </Select>
        </Field>
      </div>

      <SaveBar
        draft={draft}
        save={(values) =>
          updateDocDefaults(values).then((result) => ({
            ok: result.ok,
            error: result.ok ? undefined : Object.values(result.errors)[0],
          }))
        }
      />
    </div>
  );
}
