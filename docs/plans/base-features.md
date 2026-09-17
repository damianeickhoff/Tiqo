# Base features Tiqo is missing

Tiqo has the hard parts of a service desk already: tickets with a real reference
scheme, statuses the desk defines, teams, projects and milestones, change plans
with templates, a self-service portal with forms and published answers, roles
and permissions, an activity trail, in-app notifications, business hours and a
response clock. What follows is what a desk still expects and cannot find.

Each row links to a plan written to be picked up cold. Read
[conventions.md](conventions.md) first — every plan assumes it.

| # | Plan | Why it hurts | Depends on |
| --- | --- | --- | --- |
| 1 | [attachments.md](attachments.md) ✅ built | No screenshot, no log file, no photo of the error — anywhere in the product | — |
| 2 | [email.md](email.md) | No SMTP or IMAP at all. Notifications never leave the app, and nothing can be raised by mail | 1 (mail carries files) |
| 3 | [ticket-relations.md](ticket-relations.md) ✅ built | Only `mergedInto` exists. Nothing can block, duplicate, or parent another ticket | — |
| 4 | [documentation.md](documentation.md) | Portal answers are for requesters. The desk has nowhere to write down how anything works | — |
| 5 | [cmdb.md](cmdb.md) ✅ built | No assets, no services, no "what else is broken on this host" | 3 |
| 6 | [approvals.md](approvals.md) | Change tickets carry a plan but nothing gates them | — |
| 7 | [saved-views.md](saved-views.md) | Every operator rebuilds their queue by hand each morning | — |
| 8 | [time-tracking.md](time-tracking.md) | No worklog, so no answer to "where did the week go" | — |
| 9 | [recurring-tickets.md](recurring-tickets.md) | Standing work is remembered by a person or not at all | — |
| 10 | [audit-log.md](audit-log.md) | `Activity` is ticket- and project-scoped. Role, permission and settings changes vanish | — |

## Order, and why

**1 → 2 → 3** first. They are the gaps a desk hits on day one, they are
self-contained, and the later plans lean on them. Attachments before email
because a mail importer with nowhere to put the attachment is half an importer.
Relations before CMDB because a configuration item whose incidents cannot point
at one another is a spreadsheet.

**4 (documentation) before 5 (CMDB).** Documentation maintains itself —
whoever writes it owns it. A CMDB rots within a quarter unless something feeds
it, and deciding what feeds it is a bigger question than building the register.
See the open question at the top of that plan before starting it.

**6–10** in whatever order the desk is actually complaining about. They are
independent of each other and of everything above.

## What is deliberately not here

- **Reporting beyond the dashboard.** `src/lib/analytics.ts` and
  `dashboard-widgets.ts` already exist; extending them is tuning, not a missing
  base feature.
- **A second SLA axis** (per-team, per-type, first-response vs resolution).
  `PriorityTarget` is flat per-priority today. Worth doing, but it is a change
  to a feature that exists rather than one that does not.
- **Asset discovery agents**, satisfaction surveys, chat, and telephony. Each is
  a product in its own right.
