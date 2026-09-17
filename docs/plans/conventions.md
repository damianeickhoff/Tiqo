# Working on Tiqo — the briefing

Every plan in this folder assumes you have read this page. It is the shared
half: stack, patterns, and the handful of rules that make a new feature look
like it was always here. Read it once, then read your own plan.

## The stack

Next.js 16 (App Router, `src/app`), React 19, Tailwind 4, Prisma 7 against
Postgres, Zod 4, TipTap for the editor, `lucide-react` for icons. Postgres runs
in Docker (`docker compose up -d`, host port **5433**); everything else runs on
the host. `npm run dev`, `npm run lint`, `npm run format`.

There is no test runner in this project. "Verify" in a plan means: run
`npm run lint`, make sure the page compiles, then exercise the path in the
browser as the roles named in the plan. Do that — do not report a phase done on
the strength of the code reading correctly.

## Route groups

| Group | Who it is for | Guard |
| --- | --- | --- |
| `src/app/(app)` | the desk — operators and admins | `desk.access` |
| `src/app/(portal)` | requesters, self-service | portal enabled, signed in |
| `src/app/(auth)` | sign in / register | nobody |
| `src/app/api/v1` | the REST API, token-authenticated | per-route |

A feature that touches tickets almost always has **two** faces: the desk view
and the portal view. Check the portal side before calling a phase finished —
`src/app/(portal)/portal/(shell)/requests/[number]/page.tsx` is the requester's
version of the ticket page.

## The six things a new feature usually needs

1. **A model** in `prisma/schema.prisma`, then a migration:
   `npx prisma migrate dev --name <snake_case>`. Migration folders are named
   `<timestamp>_<snake_case>`; the CLI does that for you.
2. **A permission key** in `src/lib/permissions.ts`, added to the `PERMISSIONS`
   catalogue with a `group`. The settings screen builds itself from that list,
   so adding the key is all the wiring the roles page needs — but its *label*
   lives in the dictionaries (`permissions` and `permissionGroups` keys) and the
   build fails until both have it.
3. **A server action** in `src/lib/actions/`, `"use server"` at the top. The
   shape to copy is `src/lib/actions/tickets.ts`: `requireUser()` and
   `getMessages()` first, parse with a Zod schema from `src/lib/validation.ts`,
   check permission, write, record an activity, notify, then `refreshTicket()`
   or `revalidatePath()`. Return `{ errors: { field: message } }` rather than
   throwing — forms render those with `<FieldError>` / `<FormError>`.
4. **An `ActivityType`** if the thing that happened belongs in a ticket's
   history, plus a sentence for it in `activity` in both dictionaries. The trail
   is append-only and every ticket mutation writes a row; a feature that changes
   a ticket without leaving a trace is a bug.
5. **Strings in both dictionaries** — `src/lib/i18n/en.ts` and
   `src/lib/i18n/nl.ts`. English is the type; a missing Dutch key is a build
   failure, which is deliberate. Never put a user-visible English string in a
   component. Read it with `useMessages()` on the client, `getMessages()` on the
   server.
6. **Seed data** in `prisma/seed.ts` if the feature is invisible without any.

## Permissions

`can(user, key)`, plus the named helpers in `src/lib/permissions.ts`
(`canEditTicket`, `canViewTicket`, `canComment`, `canWriteInternalNote`, …).
Two rules that are not permissions and must never become them: raising a ticket
and reading your own. The master role short-circuits every check.

When you add a check, add it in the action, not only in the component. A hidden
button is presentation; the action is the boundary.

## UI vocabulary

`src/components/ui.tsx` has `Button`, `Input`, `Select`, `Textarea`, `Field`,
`FieldError`, `FormError`, `Card`, `CardHeader`, `EmptyState`, and the
`buttonClass` helper. Glyphs — `PriorityBars`, `StatusRing`, `HeatSpine` — are
in `src/components/tickets/indicators.tsx` and `glyphs.tsx`. `Avatar` is
`src/components/avatar.tsx`. `Modal` is `src/components/modal.tsx`.

Colours are tokens, never literals: `--bg`, `--chrome`, `--surface-1..3`,
`--line`, `--border`, `--text`, `--text-2`, `--text-3`, `--brand`,
`--brand-tint`, `--positive`, `--negative`, `--p-*` for priorities. Radii are
`rounded-control` / `rounded-card` / `rounded-panel`. Type steps are `text-xs`
through `text-2xl` with `.label` for caps labels. Both themes must work — check
light and dark before finishing.

## Drafts are saved, never live

From `CLAUDE.md`, and it is the rule most easily broken by accident: **an edit is
not written until someone presses Save.** Typing, picking from a dropdown or
ticking a box inside an editor changes a *draft*. No save-on-blur, no
save-on-change, no save-on-toggle. Save is enabled only when dirty and confirms
when it has saved.

List-level commands are the exception and take effect immediately: add, delete,
duplicate, reorder, publish/hide, feature/unfeature.

## House style

Read three or four neighbouring files before writing. The codebase has a voice:
comments explain *why a decision was made*, not what the line does, and schema
fields carry a `///` doc comment saying what the field is for and what the
alternative would have cost. Match it. A pull request that reads like a
different person wrote it is a cost even when the code is correct.

Keep changes surgical. Do not improve adjacent code, do not refactor what is not
broken, and do not delete pre-existing dead code — mention it instead.
