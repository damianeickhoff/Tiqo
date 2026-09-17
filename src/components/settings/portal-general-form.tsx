"use client";

import { updatePortal } from "@/lib/actions/settings";
import { Field, Input, Textarea } from "@/components/ui";
import { SaveBar, useDraft } from "@/components/settings/draft";
import { useMessages } from "@/components/shell/instance-context";

/**
 * The two lines of copy on the portal's front page.
 *
 * Whether the portal is open at all is not here: it is a command, not a
 * description, and it lives on the switch in this section's header.
 */
export function PortalGeneralForm({
  enabled,
  portalTitle,
  welcome,
}: {
  /// Carried through unchanged so saving the copy cannot reopen a closed
  /// portal as a side effect.
  enabled: boolean;
  portalTitle: string;
  welcome: string;
}) {
  const t = useMessages();
  const draft = useDraft({ portalEnabled: enabled, portalTitle, portalWelcome: welcome });
  const { draft: d, set } = draft;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.forms.nameLabel} htmlFor="portalTitle">
          <Input
            id="portalTitle"
            value={d.portalTitle}
            maxLength={60}
            onChange={(event) => set({ portalTitle: event.target.value })}
          />
        </Field>

        <Field label={t.forms.welcomeLabel} htmlFor="portalWelcome" hint={t.forms.welcomeHint}>
          <Textarea
            id="portalWelcome"
            rows={2}
            value={d.portalWelcome}
            maxLength={300}
            onChange={(event) => set({ portalWelcome: event.target.value })}
          />
        </Field>
      </div>

      <SaveBar draft={draft} save={updatePortal} />
    </div>
  );
}
