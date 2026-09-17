"use client";

import { updateMailSignature } from "@/lib/actions/mail";
import { render } from "@/lib/mail-templates";
import { MAIL_PAPER } from "@/lib/mail-layout";
import { Textarea } from "@/components/ui";
import { SaveBar, useDraft } from "@/components/settings/draft";
import { useMessages } from "@/components/shell/instance-context";

/**
 * The desk's sign-off, and what it will look like under a message.
 *
 * A draft like every other editor here: typing changes what is on screen and
 * nothing else until Save. The preview is the footer only — the rest of the
 * mail is not this setting's business, and showing a whole message around three
 * lines of address would be a picture of the template editor rather than of
 * this.
 */
export function MailSignatureForm({
  signature,
  sample,
  brandColor,
}: {
  signature: string;
  /// What the variables stand for, so a sign-off that names the desk shows the
  /// desk's name rather than the token.
  sample: Record<string, string>;
  brandColor: string;
}) {
  const t = useMessages();
  const draft = useDraft({ signature });
  const { draft: d, set } = draft;

  const filled = render(d.signature, sample);

  return (
    <div className="space-y-5">
      <label className="block">
        <span className="label mb-1.5 block">{t.mail.signatureLabel}</span>
        <Textarea
          rows={6}
          value={d.signature}
          maxLength={2_000}
          onChange={(event) => set({ signature: event.target.value })}
          className="font-mono text-sm"
        />
        <span className="text-text-3 mt-2 block text-sm">{t.mail.signatureHint}</span>
      </label>

      <div>
        <span className="label mb-1.5 block">{t.mail.preview}</span>
        {/* The mail's own world, not the settings page's: a footer is a light
            document whatever theme the desk reads this screen in. */}
        <div className="rounded-card p-3" style={{ background: MAIL_PAPER }}>
          <div className="rounded-control border border-[#e7e5e4] bg-white p-4">
            <div className="h-1.5 w-16 rounded-full" style={{ background: brandColor }} />
            {filled ? (
              <p className="mt-3 border-t border-[#e7e5e4] pt-3 text-[12px] leading-relaxed whitespace-pre-wrap text-[#78716c]">
                {filled}
              </p>
            ) : (
              <p className="mt-3 border-t border-[#e7e5e4] pt-3 text-[12px] text-[#a8a29e]">
                {t.mail.signatureEmpty}
              </p>
            )}
          </div>
        </div>
      </div>

      <SaveBar draft={draft} save={updateMailSignature} />
    </div>
  );
}
