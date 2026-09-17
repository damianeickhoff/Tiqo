import type { Messages } from "@/lib/i18n";

/**
 * What the desk's mail says, and the words it fills in.
 *
 * The half of templating that is safe on the client, so the editor and the
 * sender agree on one definition of what a variable is. Everything that reads
 * the database lives in `src/lib/mail.ts`.
 *
 * A template is plain text with `{{ticket.reference}}` in it. Not Markdown, not
 * HTML and not a language with conditions or loops: the mail Tiqo sends is
 * plain text, and a template engine in a settings box is a thing to debug at
 * the worst possible moment — when nobody can work out why the desk has gone
 * quiet.
 */

export const TEMPLATE_KINDS = [
  "ASSIGNED",
  "FORWARDED",
  "COMMENTED",
  "MENTIONED",
  "ANSWERED",
  "STATUS",
  "BOUNCE",
  "RECEIVED",
  "APPROVAL_REQUESTED",
  "APPROVAL_DECIDED",
] as const;

export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

export type Template = { subject: string; body: string };

/** What a ticket can say about itself. */
const TICKET = [
  "ticket.reference",
  "ticket.number",
  "ticket.title",
  "ticket.url",
  "ticket.status",
  "ticket.priority",
  "ticket.type",
  "ticket.due",
  "ticket.raised",
] as const;

/** Everyone a message can name. `recipient` is whoever is reading it; `actor`
 *  is whoever did the thing it is about. */
const PEOPLE = ["actor.name", "recipient.name", "requester.name", "assignee.name"] as const;

/** The desk itself. What it is called and where it answers — the reply hint and
 *  the link back to the ticket are the layout's, not a template's, so nobody
 *  has to place them and nothing can end up saying them twice. */
const DESK = ["desk.name", "desk.url"] as const;

const TICKET_MESSAGE = [...TICKET, ...PEOPLE, ...DESK];

/**
 * Which variables each message may use.
 *
 * Per kind rather than one list, because a variable that is empty half the time
 * is worse than one that is not offered: nothing on a bounce knows a ticket,
 * and only a reply has something somebody wrote.
 */
export const VARIABLES: Record<TemplateKind, readonly string[]> = {
  ASSIGNED: TICKET_MESSAGE,
  FORWARDED: TICKET_MESSAGE,
  COMMENTED: TICKET_MESSAGE,
  MENTIONED: TICKET_MESSAGE,
  ANSWERED: [...TICKET_MESSAGE, "comment.body"],
  STATUS: [...TICKET_MESSAGE, "status.previous"],
  BOUNCE: ["sender.address", "desk.name", "desk.url"],
  RECEIVED: TICKET_MESSAGE,
  // What is being asked is deliberately not among them, for the same reason a
  // comment is not: a question can name the thing the change is about, and the
  // person being asked is not always somebody the desk talks to in public.
  APPROVAL_REQUESTED: TICKET_MESSAGE,
  APPROVAL_DECIDED: TICKET_MESSAGE,
};

const TOKEN = /\{\{\s*([a-zA-Z][a-zA-Z.]*)\s*\}\}/g;

/**
 * The template with its blanks filled in.
 *
 * A variable with nothing behind it — no due date, no previous status, no reply
 * hint on a desk that does not collect mail — renders as nothing rather than as
 * "undefined" or as its own name. The tidy-up afterwards is what stops the gap
 * it leaves turning into a hole in the middle of the message.
 */
export function render(text: string, values: Record<string, string>) {
  return text
    .replace(TOKEN, (_whole, name: string) => values[name] ?? "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Text that cannot be read as markup.
 *
 * Everything on both sides of the rendering goes through this: the template,
 * because an admin typing `<b>` means the characters they typed; and every
 * value, because a ticket title is somebody else's writing and a title with a
 * tag in it must never become part of the message's own markup.
 */
export function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The message as paragraphs, for the laid-out half of the mail.
 *
 * The template is escaped *before* the variables are put in, and the variables
 * are escaped on their own — escaping the finished text instead would turn an
 * ampersand in somebody's name into `&amp;amp;`. The token shape survives
 * escaping untouched, which is what makes the order safe.
 *
 * A blank line starts a paragraph and a single newline is a line break, which
 * is how everybody writes in a plain box without being told.
 */
export function renderHtml(text: string, values: Record<string, string>) {
  const safe: Record<string, string> = {};
  for (const [name, value] of Object.entries(values)) safe[name] = escapeHtml(value);

  return render(escapeHtml(text), safe)
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 14px 0;">${paragraph.replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

/** The opening line of a message, which is what an inbox list shows beside the
 *  subject and what the layout hides at the top for clients to find. */
export function firstLine(text: string) {
  return text.split(/\r?\n/, 1)[0] ?? "";
}

/** The wording Tiqo ships for this message, which is what a desk that has never
 *  edited it sends. */
export function shippedTemplate(kind: TemplateKind, t: Messages): Template {
  const template = t.mail.templates[kind];
  return { subject: template.subject, body: template.body };
}
