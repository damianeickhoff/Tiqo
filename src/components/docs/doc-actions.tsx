"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  Bell,
  CircleCheck,
  Loader2,
  MoreHorizontal,
  Share2,
  Trash2,
} from "lucide-react";
import { archiveDoc, deleteDoc, markReviewed, publishDoc, snoozeReview } from "@/lib/actions/docs";
import { Modal } from "@/components/modal";
import { Button, Field, FormError, Select } from "@/components/ui";
import { useDateFormat, useMessages } from "@/components/shell/instance-context";

/**
 * Saying a page is still right.
 *
 * Its own button, beside Edit rather than inside a menu, because it is the one
 * thing on this page somebody does without reading anything else — and the
 * whole review scheme depends on confirming being cheaper than ignoring. One
 * click, no form, no edit.
 */
export function StillCorrectButton({ docId, className }: { docId: string; className?: string }) {
  const t = useMessages();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      disabled={pending || done}
      onClick={() =>
        startTransition(async () => {
          const result = await markReviewed(docId);
          if (result.ok) setDone(true);
        })
      }
    >
      {pending ? (
        <Loader2 size={13} className="animate-spin" />
      ) : (
        <CircleCheck size={13} className={done ? "text-positive" : undefined} />
      )}
      {pending ? t.docs.confirming : t.docs.stillCorrect}
    </Button>
  );
}

/**
 * "Not today."
 *
 * The other honest answer to a page that is due. Without it the only two are
 * to press Still correct on something nobody has read, or to let the notice
 * repeat until it is furniture — and both of those end with a review date
 * nobody believes.
 */
export function RemindMeButton({
  docId,
  /// Only ever a date still in the future: whether a snooze has run out is a
  /// question about now, and now is read on the server where there is one
  /// clock rather than one per render.
  snoozedTo,
}: {
  docId: string;
  snoozedTo: Date | null;
}) {
  const t = useMessages();
  const when = useDateFormat({ day: "numeric", month: "short" });
  const [pending, startTransition] = useTransition();
  const [until, setUntil] = useState<Date | null>(snoozedTo);

  if (until) {
    return (
      <span className="text-text-3 flex flex-1 items-center justify-center gap-1.5 text-sm">
        <Bell size={12} />
        {t.docs.remindedOn(when.format(until))}
      </span>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="flex-1 justify-center"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await snoozeReview(docId);
          if (result.ok) {
            setUntil(new Date(Date.now() + result.days * 24 * 60 * 60 * 1000));
          }
        })
      }
    >
      {pending ? <Loader2 size={13} className="animate-spin" /> : <Bell size={13} />}
      {t.docs.remindMe}
    </Button>
  );
}

export type PortalSection = { id: string; name: string };

/**
 * Everything else that can be done to a page, behind one button.
 *
 * Archiving, publishing and deleting are all rare, all consequential, and none
 * of them is what somebody came to the page to do — so they sit together and
 * out of the way of Edit. The dialogs are siblings of the menu rather than
 * children of it: a dialog opened from a menu that then closes is a dialog that
 * closes with it.
 */
export function DocMenu({
  docId,
  title,
  spaceHref,
  isArchived,
  isPublished,
  sections,
  proposedCategoryId,
  canManage,
}: {
  docId: string;
  title: string;
  spaceHref: string;
  isArchived: boolean;
  /// Whether this page already has an answer on the portal, which decides
  /// whether publishing reads as "publish" or as "publish again".
  isPublished: boolean;
  sections: PortalSection[];
  /// Where the shelf says an answer from here belongs. A proposal only — one
  /// shelf can feed two sections, and the wrong default is worse than none.
  proposedCategoryId: string | null;
  canManage: boolean;
}) {
  const t = useMessages();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState<"delete" | "publish" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [categoryId, setCategoryId] = useState(proposedCategoryId ?? "");
  const [live, setLive] = useState(true);

  if (!canManage) return null;

  function remove() {
    startTransition(async () => {
      const result = await deleteDoc(docId);
      if (!result.ok) {
        setError(result.error ?? t.errors.generic);
        return;
      }
      setAsking(null);
      router.push(spaceHref);
    });
  }

  function publish() {
    startTransition(async () => {
      const result = await publishDoc(docId, { categoryId: categoryId || null, isPublished: live });
      if (!result.ok) {
        setError(Object.values(result.errors)[0] ?? t.errors.generic);
        return;
      }
      setAsking(null);
      setError(null);
    });
  }

  return (
    <div className="relative shrink-0">
      {/* Out here rather than inside the menu, which is closed by the time
          there is anything to say. */}
      {error && !asking ? (
        <p
          role="alert"
          className="border-negative/35 bg-negative/[0.07] text-negative rounded-control absolute top-10 right-0 z-50 w-64 border px-3 py-2 text-sm font-medium"
        >
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t.common.more}
        className="border-line bg-surface text-text-2 hover:border-line-strong hover:text-text rounded-control flex size-8 items-center justify-center border shadow-[var(--highlight)] transition-colors"
      >
        <MoreHorizontal size={15} />
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="animate-rise border-line bg-surface rounded-card absolute right-0 z-50 mt-2 w-60 overflow-hidden border p-1 shadow-[var(--shadow-float)]"
          >
            <Row
              icon={<Share2 size={14} className="text-text-3" />}
              label={isPublished ? t.docs.republish : t.docs.publish}
              onClick={() => {
                setOpen(false);
                setError(null);
                setAsking("publish");
              }}
            />

            <Row
              icon={
                isArchived ? (
                  <ArchiveRestore size={14} className="text-text-3" />
                ) : (
                  <Archive size={14} className="text-text-3" />
                )
              }
              label={isArchived ? t.docs.unarchive : t.docs.archive}
              disabled={pending}
              onClick={() => {
                setOpen(false);
                startTransition(async () => {
                  // Archiving takes the whole subtree with it and can be
                  // refused; a menu item that closes and changes nothing is
                  // indistinguishable from one that worked.
                  const result = await archiveDoc(docId, !isArchived);
                  setError(result.ok ? null : (result.error ?? t.errors.generic));
                });
              }}
            />

            <Row
              icon={<Trash2 size={14} />}
              label={t.common.delete}
              danger
              onClick={() => {
                setOpen(false);
                setError(null);
                setAsking("delete");
              }}
            />
          </div>
        </>
      ) : null}

      {asking === "publish" ? (
        <Modal
          title={t.docs.publishTitle}
          description={isPublished ? t.docs.republishBlurb : t.docs.publishBlurb}
          onClose={() => setAsking(null)}
        >
          <div className="space-y-4">
            <FormError>{error ?? undefined}</FormError>

            <Field label={t.docs.publishCategory}>
              <Select
                value={categoryId}
                aria-label={t.docs.publishCategory}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                <option value="">{t.docs.noCategory}</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </Select>
            </Field>

            <label className="flex items-center gap-2.5 text-base">
              <input
                type="checkbox"
                checked={live}
                onChange={(event) => setLive(event.target.checked)}
                className="accent-brand size-4"
              />
              {t.docs.publishLive}
            </label>

            <div className="border-line flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="ghost" onClick={() => setAsking(null)}>
                {t.common.cancel}
              </Button>
              <Button type="button" disabled={pending} onClick={publish}>
                {pending ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
                {isPublished ? t.docs.republish : t.docs.publish}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {asking === "delete" ? (
        <Modal
          title={t.common.deleteThing(title)}
          description={`${t.docs.deleteBlurb} ${t.common.deleteBlurb}`}
          onClose={() => setAsking(null)}
        >
          {error ? (
            <p className="bg-negative/[0.06] text-negative rounded-control mb-4 px-4 py-2 text-base font-medium">
              {error}
            </p>
          ) : null}

          <div className="border-line flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="ghost" onClick={() => setAsking(null)}>
              {t.common.cancel}
            </Button>
            <button
              type="button"
              disabled={pending}
              onClick={remove}
              className="bg-negative rounded-control text-md inline-flex h-9 items-center gap-1.5 px-4 font-semibold text-white disabled:opacity-50"
            >
              <Trash2 size={14} />
              {pending ? t.common.deleting : t.common.delete}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function Row({
  icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={
        "rounded-control flex w-full items-center gap-2.5 px-2.5 py-2 text-left text-base font-medium transition-colors " +
        (danger ? "text-negative hover:bg-negative/10" : "hover:bg-surface-2")
      }
    >
      {icon}
      {label}
    </button>
  );
}
