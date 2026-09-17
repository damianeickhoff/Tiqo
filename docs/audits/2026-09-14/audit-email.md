# Email (in and out) — audit

Overall: core well built; leak rules correct; poll route correct; template/HTML layer good. Serious problems are inbound: no authorisation on a threaded reply, no idempotency for replies, bounce loop.

## 1. Broken / buggy

### Critical
1.1 **Inbound reply has no authorisation.** `mail-inbox.ts:168-178`, `:249` — `threadOnto()` resolves by subject reference; `reply()` writes as sender with no `canComment`/participation test (in-app path checks at `actions/tickets.ts:473`). References are guessable; with selfRegistration on, any address on the internet can post to any ticket and trigger an ANSWERED mail to its requester.
1.2 **No idempotency on replies.** `mail-inbox.ts:78-95` — `\Seen` added after `file()`; a drop between comment write and flag re-files the comment. Only `raise()` is protected by the unique pair.
1.3 **No Message-ID → dedupe fails.** `mail-inbox.ts:301-309` — null externalId; NULLs distinct in unique index → N tickets.
1.4 **Bounce loop, unthrottled.** `mail-inbox.ts:162-166`, `isAutomated` `:437-447` — no `Return-Path: <>`, `multipart/report`, `X-Failed-Recipients`, MAILER-DAEMON/postmaster check; no per-address rate limit.

### Significant
1.5 **Quote stripping misses Dutch/German/Outlook.** `mail-inbox.ts:467` `QUOTED` lacks `Op … schreef:`, `Am … schrieb:`, `Von:`, `De:`, `-----Original Message-----` / `-----Oorspronkelijk bericht-----`; `From:\s` and `-{2,}$` false-positive prone.
1.6 **Inline (cid:) images attached as files.** `mail-inbox.ts:510-519` — ignores `related` / `contentDisposition === "inline"`.
1.7 **No total attachment budget per message.** `mail-inbox.ts:512` — 10 × 25 MB buffered by simpleParser.
1.8 **drainOutbox has no cross-process guard.** `route.ts:27` module flag only; `mail.ts:578-582` selects PENDING then updates after SMTP. Fix: claim rows (`SENDING`) or advisory lock.
1.9 `bodyOf` (`mail-inbox.ts:451-464`) leaves `<script>` text, `<head>`/`<title>`, HTML comments; decodes only five entities. **No XSS** — `literal()` escapes, markdown.tsx has no dangerouslySetInnerHTML, SAFE_LINK gate.
1.10 **No mail for APPROVAL_* kinds.** `mail.ts:267-272`.

### Minor / verified
(a) internal-note leak correct (`actions/tickets.ts:589` inheritedInternal; `mail.ts:326-335`). (b) own action guarded (`notify.ts:33`, `mail.ts:354,397`). (c) threading order correct; subject regex tolerant (`:487`); `findFirst` at `:198` no orderBy; inbound Message-IDs never stored (third-party reply to requester's original falls to subject). (k) Test doesn't save. (l) poll auth 401 when unset, timingSafeEqual. (m) template escaping correct; preview iframe sandboxed. (j) passwords not leaked (`hasPassword`); no env fallback — document in README/.env.example. (o) references applied; blocked words deliberately skipped; `reply()` is a second copy of addComment drifting (skips stepId routing, reply-status guard at `tickets.ts:559`). (p) nl complete; dead keys `mail.shippedAgain`, `mail.editTemplate`, maybe `mail.title`/`mail.blurb`. `messageIdFor` (`mail.ts:554`) derives domain from fromEmail (retry id changes if sender changes). Message throwing in `file()` retried forever, occupies a batch slot (`:80-85`). `useShipped` (`mail-template-manager.tsx:79`) named like a hook — lint is clean though.

## 2. Plan gaps
All phases delivered. Deviations: drainInbox moved to `mail-inbox.ts` (fine); `reply()` is not addComment reuse; HTML mail + UI templates built despite out-of-scope. Implied but missing: **no acknowledgement to someone raising a ticket by mail** (`raise()` `:294`, no RECEIVED kind), **no desk notification that a mail-raised ticket exists** (`raise()` calls no notify()).

## 3. Overbuilt
- `mail-layout.ts` earns its weight; keep.
- Template editor: drop `unknownTokens` save-time refusal (`mail-templates.ts:62-70`, `actions/mail.ts:145-146`); preview iframe re-renders per keystroke (`mail-template-manager.tsx:225-307`) and duplicates send-time composition (`:242-252` vs `mail.ts:238-255`) — debounce; seven editable kinds is more than needed (ASSIGNED/FORWARDED/COMMENTED/MENTIONED identical).

## 4. Underbuilt
4.1 **No mail log / outbox view / resend** — `MailMessage` has no reader; `Ticket.mails` never queried; FAILED rows dead forever. Largest gap.
4.2 No per-ticket "sent mails".
4.3 No reply-above-this-line marker.
4.4 No signature block.
4.5 CC ignored both directions.
4.6 Cannot send a mail from a ticket to a third party.
4.7 No per-user mail preference / List-Unsubscribe.
4.8 Mail-created accounts indistinguishable; no rate limit on creation.
4.9 No `maxDuration` on the poll route.

## 5. Missing useful features
1. Mail log with resend (Settings → Mail → Recent). 2. RECEIVED template on mail-raised ticket. 3. Reply-above-this-line marker + marker-first stripping. 4. Approval mail. 5. Desk signature block. 6. Bounce suppression (seen-address ledger + DSN detection).

## 6. Design / UI
Correct: `SettingsSection` (house settings pattern, not Card); tokens; drafts via useDraft/SaveBar; reset-to-shipped immediate; hasPassword hint.
Problems:
1. Dirty template draft invisible once collapsed (`mail-template-manager.tsx:141`, summary row `:117-139`).
2. Preview iframe reloads per keystroke (`:294`).
3. Light-only preview in dark page with no framing.
4. Four control idioms (SaveBar discard, TestButton outline, `useShipped` pill `:196-204`, preview toggle `:258-276`).
5. Test result never cleared on edit (`mail-forms.tsx:277-285`).
6. Two TLS checkboxes not parallel (`mail-forms.tsx:84-95` vs `:183-191`).
7. Poll URL `break-all` ragged, no copy affordance (`settings/mail/page.tsx:108`).
8. `pollTokenMissing` red on a fresh instance (`:114`).

## Top 10
1. Authorise inbound replies (reporter, assignee, participant, or canComment; else bounce/hold).
2. Make `reply()` idempotent (store inbound Message-IDs).
3. Synthesise Message-ID when missing.
4. Close the bounce loop (DSN detection + once-per-day per address).
5. Mail log with resend.
6. Reply-above-this-line marker, cut on it first.
7. Skip inline/related attachments; cap total bytes per message.
8. Extend QUOTED for NL/DE/FR/Outlook; tighten From:/dash rules.
9. RECEIVED acknowledgement + notify desk on mail-raised ticket.
10. Claim outbox rows before sending; add APPROVAL_* templates.
