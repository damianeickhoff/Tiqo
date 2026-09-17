"use client";

import { useState, useTransition } from "react";
import { Loader2, PlugZap } from "lucide-react";
import {
  testMailCollecting,
  testMailSending,
  updateMailCollecting,
  updateMailSending,
} from "@/lib/actions/mail";
import { Button, Field, Input } from "@/components/ui";
import { SaveBar, useDraft } from "@/components/settings/draft";
import { useMessages } from "@/components/shell/instance-context";

/**
 * The two halves of a mail server, as two forms.
 *
 * Sending and collecting are separate settings because they are separate
 * decisions: plenty of desks send through a relay that has no mailbox on it at
 * all. Either card works on its own, and the blank one is not an error.
 *
 * Passwords never come back from the server, so the field starts empty and an
 * empty field means "keep what is stored" — said under the field, because a
 * blank password box otherwise reads as "there is no password".
 */

export type SendingSettings = {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  hasPassword: boolean;
  fromName: string;
  fromEmail: string;
};

export type CollectingSettings = {
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  imapUser: string;
  hasPassword: boolean;
  imapFolder: string;
  archiveFolder: string;
};

export function MailSendingForm({ settings }: { settings: SendingSettings }) {
  const t = useMessages();
  const draft = useDraft({
    smtpHost: settings.smtpHost,
    // As a string: the input holds text, and a draft compares what is in it.
    smtpPort: String(settings.smtpPort),
    smtpSecure: settings.smtpSecure,
    smtpUser: settings.smtpUser,
    smtpPass: "",
    fromName: settings.fromName,
    fromEmail: settings.fromEmail,
  });
  const { draft: d, set } = draft;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_7rem]">
        <Field label={t.mail.host} htmlFor="smtpHost">
          <Input
            id="smtpHost"
            value={d.smtpHost}
            placeholder="smtp.example.com"
            autoComplete="off"
            onChange={(event) => set({ smtpHost: event.target.value })}
          />
        </Field>

        <Field label={t.mail.port} htmlFor="smtpPort">
          <Input
            id="smtpPort"
            inputMode="numeric"
            value={d.smtpPort}
            onChange={(event) => set({ smtpPort: event.target.value })}
          />
        </Field>
      </div>

      <label className="text-md flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          checked={d.smtpSecure}
          onChange={(event) => set({ smtpSecure: event.target.checked })}
          className="mt-0.5 size-4 accent-[var(--brand)]"
        />
        <span>
          {t.mail.smtpTls}
          <span className="text-text-3 mt-0.5 block text-sm">{t.mail.smtpTlsHint}</span>
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.mail.user} htmlFor="smtpUser">
          <Input
            id="smtpUser"
            value={d.smtpUser}
            autoComplete="off"
            onChange={(event) => set({ smtpUser: event.target.value })}
          />
        </Field>

        <Field
          label={t.mail.password}
          htmlFor="smtpPass"
          hint={settings.hasPassword ? t.mail.passwordHint : undefined}
        >
          <Input
            id="smtpPass"
            type="password"
            value={d.smtpPass}
            autoComplete="new-password"
            placeholder={settings.hasPassword ? t.mail.passwordKept : ""}
            onChange={(event) => set({ smtpPass: event.target.value })}
          />
        </Field>

        <Field label={t.mail.fromName} htmlFor="fromName">
          <Input
            id="fromName"
            value={d.fromName}
            maxLength={80}
            onChange={(event) => set({ fromName: event.target.value })}
          />
        </Field>

        <Field label={t.mail.fromEmail} htmlFor="fromEmail">
          <Input
            id="fromEmail"
            value={d.fromEmail}
            placeholder="support@example.com"
            onChange={(event) => set({ fromEmail: event.target.value })}
          />
        </Field>
      </div>

      <TestButton run={() => testMailSending(d)} against={d} />
      <SaveBar draft={draft} save={updateMailSending} />
    </div>
  );
}

export function MailCollectingForm({ settings }: { settings: CollectingSettings }) {
  const t = useMessages();
  const draft = useDraft({
    imapHost: settings.imapHost,
    imapPort: String(settings.imapPort),
    imapSecure: settings.imapSecure,
    imapUser: settings.imapUser,
    imapPass: "",
    imapFolder: settings.imapFolder,
    archiveFolder: settings.archiveFolder,
  });
  const { draft: d, set } = draft;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_7rem]">
        <Field label={t.mail.host} htmlFor="imapHost">
          <Input
            id="imapHost"
            value={d.imapHost}
            placeholder="imap.example.com"
            autoComplete="off"
            onChange={(event) => set({ imapHost: event.target.value })}
          />
        </Field>

        <Field label={t.mail.port} htmlFor="imapPort">
          <Input
            id="imapPort"
            inputMode="numeric"
            value={d.imapPort}
            onChange={(event) => set({ imapPort: event.target.value })}
          />
        </Field>
      </div>

      {/* The same shape as its opposite number on the sending form: two
          checkboxes that mean the same thing and read differently is two
          decisions where there is one. */}
      <label className="text-md flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          checked={d.imapSecure}
          onChange={(event) => set({ imapSecure: event.target.checked })}
          className="mt-0.5 size-4 accent-[var(--brand)]"
        />
        <span>
          {t.mail.imapTls}
          <span className="text-text-3 mt-0.5 block text-sm">{t.mail.imapTlsHint}</span>
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.mail.user} htmlFor="imapUser">
          <Input
            id="imapUser"
            value={d.imapUser}
            autoComplete="off"
            onChange={(event) => set({ imapUser: event.target.value })}
          />
        </Field>

        <Field
          label={t.mail.password}
          htmlFor="imapPass"
          hint={settings.hasPassword ? t.mail.passwordHint : undefined}
        >
          <Input
            id="imapPass"
            type="password"
            value={d.imapPass}
            autoComplete="new-password"
            placeholder={settings.hasPassword ? t.mail.passwordKept : ""}
            onChange={(event) => set({ imapPass: event.target.value })}
          />
        </Field>

        <Field label={t.mail.folder} htmlFor="imapFolder">
          <Input
            id="imapFolder"
            value={d.imapFolder}
            maxLength={100}
            onChange={(event) => set({ imapFolder: event.target.value })}
          />
        </Field>

        <Field label={t.mail.archiveFolder} htmlFor="archiveFolder" hint={t.mail.archiveHint}>
          <Input
            id="archiveFolder"
            value={d.archiveFolder}
            maxLength={100}
            onChange={(event) => set({ archiveFolder: event.target.value })}
          />
        </Field>
      </div>

      <TestButton run={() => testMailCollecting(d)} against={d} />
      <SaveBar draft={draft} save={updateMailCollecting} />
    </div>
  );
}

/**
 * Connects with what is on screen and says what happened.
 *
 * The server's own sentence is shown rather than a house one: "535
 * authentication failed" tells an admin where to look, and "that did not work"
 * sends them to the wrong half of the form.
 */
function TestButton({
  run,
  against,
}: {
  run: () => Promise<{ ok: boolean; error?: string }>;
  /// The draft the answer was true of. A green tick left standing over a host
  /// somebody has since retyped is the most misleading thing on this page.
  against: unknown;
}) {
  const t = useMessages();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ from: unknown; ok: boolean; error?: string } | null>(null);
  const answer = result && result.from === against ? result : null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setResult(null);
            setResult({ from: against, ...(await run()) });
          })
        }
      >
        {pending ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <PlugZap size={14} strokeWidth={2} />
        )}
        {pending ? t.mail.testing : t.mail.test}
      </Button>

      {answer?.ok ? (
        <span className="text-positive animate-fade text-sm font-medium">{t.mail.testPassed}</span>
      ) : null}

      {answer && !answer.ok ? (
        <span className="text-negative animate-fade min-w-0 text-sm font-medium">
          {answer.error}
        </span>
      ) : null}

      {!answer && !pending ? <span className="text-text-3 text-sm">{t.mail.testBlurb}</span> : null}
    </div>
  );
}
