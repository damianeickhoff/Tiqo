"use client";

import { useActionState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff, Pin, Plus, Trash2 } from "lucide-react";
import { ConfirmDelete } from "@/components/confirm-delete";
import type { AnnouncementTone } from "@/generated/prisma/enums";
import {
  createAnnouncement,
  deleteAnnouncement,
  updateAnnouncement,
} from "@/lib/actions/portal-admin";
import { Announcement } from "@/components/portal/portal-pieces";
import { Button, Card, FieldError, FormError, Input, Select, Textarea } from "@/components/ui";
import { SaveBar, useDraft } from "@/components/settings/draft";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

const TONES: AnnouncementTone[] = ["INFO", "WARNING", "OUTAGE"];

type Notice = {
  id: string;
  title: string;
  body: string | null;
  tone: AnnouncementTone;
  isActive: boolean;
  endsAt: Date | null;
  isBanner: boolean;
};

/** A date as the datetime input wants it, in the reader's own zone. */
function asLocal(value: Date | null) {
  if (!value) return "";
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

/**
 * Notices, shown exactly as the portal will show them. A banner is a piece of
 * design as much as a piece of text, and an admin should not have to publish it
 * to find out what it looks like.
 */
export function NoticeManager({ notices }: { notices: Notice[] }) {
  const t = useMessages();
  const [state, formAction] = useActionState(createAnnouncement, undefined);
  const errors = state?.errors ?? {};

  return (
    <div className="space-y-4">
      {notices.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-text-3 text-md">{t.forms.noNotices}</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {notices.map((notice) => (
            <li key={notice.id}>
              <NoticeRow notice={notice} />
            </li>
          ))}
        </ul>
      )}

      <Card className="p-4">
        <form action={formAction} className="space-y-3">
          <p className="label">{t.forms.newNotice}</p>
          <FormError>{errors.form}</FormError>

          <div className="flex flex-wrap items-end gap-3">
            <label className="block min-w-[14rem] flex-1">
              <span className="label mb-1.5 block">{t.forms.noticeTitle}</span>
              <Input name="title" maxLength={160} placeholder={t.forms.noticePlaceholder} />
            </label>

            <label className="block">
              <span className="label mb-1.5 block">{t.forms.tone}</span>
              <Select name="tone" defaultValue="INFO" className="w-auto">
                {TONES.map((tone) => (
                  <option key={tone} value={tone}>
                    {t.forms.tones[tone]}
                  </option>
                ))}
              </Select>
            </label>

            <AddButton />
          </div>

          <label className="block">
            <span className="label mb-1.5 block">{t.forms.noticeBody}</span>
            <Textarea name="body" rows={2} maxLength={600} placeholder={t.common.optional} />
          </label>

          <FieldError>{errors.title}</FieldError>
        </form>
      </Card>
    </div>
  );
}

function NoticeRow({ notice }: { notice: Notice }) {
  const t = useMessages();
  const [pending, startTransition] = useTransition();

  const draft = useDraft({
    title: notice.title,
    body: notice.body ?? "",
    tone: notice.tone as AnnouncementTone,
    endsAt: asLocal(notice.endsAt),
  });
  const { draft: form, set } = draft;

  return (
    <Card className={cn("space-y-3 p-4", !notice.isActive && "opacity-60")}>
      {/* The preview follows the draft, not the saved row: what a notice will
          look like is the whole question, and answering it after saving is too
          late to be of use. */}
      <Announcement
        title={form.title || notice.title}
        body={form.body || null}
        tone={form.tone}
        endsAt={form.endsAt ? new Date(form.endsAt) : null}
      />

      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-[12rem] flex-1">
          <span className="label mb-1.5 block">{t.forms.noticeTitle}</span>
          <Input
            value={form.title}
            maxLength={160}
            onChange={(event) => set({ title: event.target.value })}
            className="h-9 text-base"
          />
        </label>

        <label className="block min-w-[14rem] flex-[2]">
          <span className="label mb-1.5 block">{t.forms.noticeBody}</span>
          <Input
            value={form.body}
            maxLength={600}
            placeholder={t.common.optional}
            onChange={(event) => set({ body: event.target.value })}
            className="h-9 text-base"
          />
        </label>

        <label className="block">
          <span className="label mb-1.5 block">{t.forms.tone}</span>
          <Select
            value={form.tone}
            onChange={(event) => set({ tone: event.target.value as AnnouncementTone })}
            className="h-9 w-auto text-base"
          >
            {TONES.map((tone) => (
              <option key={tone} value={tone}>
                {t.forms.tones[tone]}
              </option>
            ))}
          </Select>
        </label>

        <label className="block">
          <span className="label mb-1.5 block">{t.forms.noticeEnds}</span>
          <Input
            type="datetime-local"
            value={form.endsAt}
            onChange={(event) => set({ endsAt: event.target.value })}
            className="h-9 w-auto text-base"
          />
        </label>

        <span className="flex items-center gap-0.5">
          {/* Pinning is a command, not a description: it takes effect at once
              and takes the banner off whichever notice had it. */}
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(
                () => void updateAnnouncement(notice.id, { isBanner: !notice.isBanner }),
              )
            }
            aria-pressed={notice.isBanner}
            aria-label={t.forms.banner}
            title={t.forms.bannerHint}
            className={cn(
              "rounded-control flex size-9 items-center justify-center transition-colors",
              notice.isBanner
                ? "text-brand-deep bg-[var(--brand-tint)]"
                : "text-text-3 hover:bg-surface-3 hover:text-text",
            )}
          >
            <Pin size={15} />
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(
                () => void updateAnnouncement(notice.id, { isActive: !notice.isActive }),
              )
            }
            aria-label={notice.isActive ? t.forms.hide : t.forms.show}
            title={notice.isActive ? t.forms.hide : t.forms.show}
            className="text-text-3 hover:bg-surface-3 hover:text-text rounded-control flex size-9 items-center justify-center"
          >
            {notice.isActive ? <Eye size={15} /> : <EyeOff size={15} />}
          </button>
          <ConfirmDelete
            title={t.common.deleteThing(notice.title)}
            run={async () => void deleteAnnouncement(notice.id)}
          >
            {(ask) => (
              <button
                type="button"
                onClick={ask}
                aria-label={t.common.deleteThing(notice.title)}
                className="text-text-3 hover:bg-negative/12 hover:text-negative rounded-control flex size-9 items-center justify-center"
              >
                <Trash2 size={15} />
              </button>
            )}
          </ConfirmDelete>
        </span>
      </div>

      <SaveBar
        draft={draft}
        save={(values) =>
          updateAnnouncement(notice.id, {
            title: values.title,
            body: values.body,
            tone: values.tone,
            endsAt: values.endsAt,
          })
        }
      />
    </Card>
  );
}

function AddButton() {
  const { pending } = useFormStatus();
  const t = useMessages();
  return (
    <Button type="submit" disabled={pending}>
      <Plus size={15} strokeWidth={2.5} />
      {pending ? t.common.adding : t.forms.addNotice}
    </Button>
  );
}
