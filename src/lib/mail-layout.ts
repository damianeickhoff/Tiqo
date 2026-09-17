import { escapeHtml } from "@/lib/mail-templates";

/**
 * What a message looks like when it arrives.
 *
 * Hand-written table HTML with every style inline, because that is what mail
 * clients render: no stylesheet, no flexbox, no grid, no custom properties.
 * Outlook drops half of modern CSS and Gmail strips `<style>` blocks, so the
 * rule here is 2005 markup and 2025 taste.
 *
 * The desk writes the *message*; this writes everything around it — the brand
 * band, the ticket it is about, the way back into the app, and the footer. A
 * desk that wants the whole document can take this one over: `shippedLayout()`
 * hands out exactly what is sent below, as a string with `{placeholders}` in
 * it, and `renderLayout()` fills either one in. One definition, so the layout
 * somebody starts editing is the layout they were receiving.
 *
 * Light only, deliberately. A dark-mode mail is a dark-mode mail in the clients
 * that support it and a broken one in the clients that half-support it, and
 * this is not the place to find out which is which.
 */

const INK = "#1c1917";
const MUTED = "#78716c";
const FAINT = "#a8a29e";
const LINE = "#e7e5e4";
/// The ground a mail client puts behind a message. Exported because the
/// settings preview frames its iframe in the same colour — a mail is a light
/// document whatever theme the desk is reading the settings page in, and two
/// copies of that shade would drift.
export const MAIL_PAPER = "#f5f4f2";
const PAPER = MAIL_PAPER;

/// System stacks only. A web font in mail is a request most clients refuse and
/// a fallback everyone else sees anyway.
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

/**
 * The line a reply is written above.
 *
 * Every mail client quotes the message being answered, and a desk that has not
 * put one of these at the top of its mail ends up filing the whole history of a
 * conversation as the next comment in it. Cutting on quote markers alone is
 * guesswork across languages and clients; cutting on a line the desk itself
 * wrote is not.
 *
 * The fence is language-independent on purpose. The sentence between the equals
 * signs is in whatever language the desk was running in when the message went
 * out, and the mailbox reading the reply has no way of knowing which that was —
 * but it can always see the fence.
 */
export const REPLY_FENCE = "====";

export function replyMarker(sentence: string) {
  return `${REPLY_FENCE} ${sentence} ${REPLY_FENCE}`;
}

export type Chrome = {
  /// The message itself, already HTML: paragraphs built from the template.
  content: string;
  /// The line an inbox list shows next to the subject. Without one, clients
  /// take whatever text comes first — which here would be the desk's own name,
  /// repeated on every message in the list.
  preheader: string;
  /// Filled-in variables. The layout reads the same ones a template can.
  values: Record<string, string>;
  brandColor: string;
  /// Off for the one message that has no ticket behind it — a card naming a
  /// ticket that does not exist is worse than no card.
  withTicket: boolean;
  /// What the desk signs off with, already filled in. One setting rather than a
  /// line in each of the ten templates: opening hours typed ten times are nine
  /// places to forget when the hours change.
  signature?: string;
  /// The subject, already filled in. The document's own title, which is what a
  /// client shows when it opens a message in a window of its own.
  subject?: string;
  /// The document the desk has taken over, or null for the one Tiqo ships.
  layout?: string | null;
  labels: {
    openTicket: string;
    replyHint: string;
    /// The sentence inside the reply marker, or empty on a desk that collects
    /// no mail — telling somebody to answer a mailbox nobody reads is worse
    /// than telling them nothing.
    replyAbove: string;
  };
};

/**
 * Black or white over the brand colour, whichever can be read.
 *
 * The brand is an instance setting, so it can be anything: amber wants dark
 * text on it and navy wants light, and guessing one of them makes the other
 * unreadable. Relative luminance, the same test the contrast rules use.
 */
export function inkOn(hex: string) {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  if (!Number.isFinite(value)) return INK;

  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => {
    const part = channel / 255;
    return part <= 0.03928 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4;
  });

  const luminance = 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
  return luminance > 0.42 ? INK : "#ffffff";
}

/* ------------------------------------------------------------- the layout -- */

/**
 * The parts a layout has holes for.
 *
 * Values rather than markup, so a layout can put any of them anywhere: the
 * shipped one sets the reference above the title, and a desk that wants it in
 * the footer only has to move the word. Everything here is escaped on the way
 * in except the two that are markup already — see `SAFE`.
 */
export type LayoutParts = {
  /// The message, as paragraphs. Already HTML, and already escaped: it is what
  /// the wording rendered, which is the one part a layout must not re-escape.
  body: string;
  subject: string;
  preheader: string;
  /// The sign-off, escaped here so its line breaks survive as `<br>`.
  signature: string;
  reference: string;
  title: string;
  /// Status · priority · type, joined. One hole rather than three, because it
  /// is one line and two of the three are often empty.
  meta: string;
  link: string;
  marker: string;
  desk: string;
  deskUrl: string;
  /// The desk's address without its protocol, which is how a link reads in a
  /// footer that is already saying where it comes from.
  deskHost: string;
  brand: string;
  /// Black or white, whichever can be read over the brand colour.
  ink: string;
};

/// Every hole, in the order the shipped layout uses them. The editor offers
/// these to click the way it offers variables: a document with `{referance}` in
/// it is a footer that has lost its ticket number, and finding that out from a
/// real mail is finding out too late.
export const LAYOUT_HOLES = [
  "body",
  "subject",
  "preheader",
  "reference",
  "title",
  "meta",
  "link",
  "marker",
  "signature",
  "desk",
  "deskUrl",
  "deskHost",
  "brand",
  "ink",
] as const;

/// The two holes that are markup by the time they get here. Everything else is
/// somebody's writing — a ticket title with a tag in it must never become part
/// of the message's own markup.
const SAFE: ReadonlySet<string> = new Set(["body", "signature"]);

/// A `{hole}` in the layout, or a `{{variable}}` of the kind the wording uses.
/// One expression for both, so a value that happens to contain braces is not
/// read again as a hole of its own.
const HOLE = /\{\{\s*([a-zA-Z][a-zA-Z.]*)\s*\}\}|\{([a-z][a-zA-Z]*)\}/g;

/**
 * A layout with its holes filled in.
 *
 * A name nothing answers to is left exactly as it was written rather than
 * emptied: in a document of hand-written HTML a silently vanishing brace is a
 * thing to debug at midnight, and a `{heder}` still on screen says what went
 * wrong by itself.
 */
export function renderLayout(
  layout: string,
  parts: LayoutParts,
  values: Record<string, string>,
): string {
  const holes = parts as unknown as Record<string, string | undefined>;

  return layout.replace(HOLE, (whole, variable: string | undefined, hole: string | undefined) => {
    if (variable !== undefined) {
      const value = values[variable];
      return value === undefined ? whole : escapeHtml(value);
    }

    const value = holes[hole!];
    if (value === undefined) return whole;
    return SAFE.has(hole!) ? value : escapeHtml(value);
  });
}

/// What a message is shaped like, which is the little the layout cannot express
/// as a hole: a bounce has no ticket to draw a card for, and a desk that
/// collects no mail must not tell anybody to reply.
export type LayoutShape = {
  withTicket: boolean;
  withReply: boolean;
  withSignature: boolean;
  labels: { openTicket: string; replyHint: string };
};

/**
 * The document Tiqo ships, as something somebody can edit.
 *
 * Built for one message rather than for all of them, because the parts that
 * cannot be a hole are decided per message — and a layout the desk then saves
 * is that message's, so it never has to ask again.
 */
export function shippedLayout({ withTicket, withReply, withSignature, labels }: LayoutShape) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>{subject}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">{preheader}${"&#8202;&zwnj;".repeat(60)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${PAPER};">
<tr><td align="center" style="padding:28px 12px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:100%;background:#ffffff;border:1px solid ${LINE};border-radius:14px;overflow:hidden;">

<tr><td style="background:{brand};padding:16px 24px;">
<span style="font-family:${SANS};font-size:15px;font-weight:700;letter-spacing:.01em;color:{ink};">{desk}</span>
</td></tr>

${
  withReply
    ? `<tr><td align="center" style="padding:12px 24px 0 24px;font-family:${MONO};font-size:11px;line-height:1.5;color:${FAINT};">{marker}</td></tr>

`
    : ""
}${
    withTicket
      ? `<tr><td style="padding:22px 24px 0 24px;">
<div style="font-family:${MONO};font-size:12px;letter-spacing:.04em;color:${MUTED};">{reference}</div>
<div style="margin-top:4px;font-family:${SANS};font-size:19px;line-height:1.3;font-weight:700;color:${INK};">{title}</div>
<div style="margin-top:6px;font-family:${SANS};font-size:12px;font-weight:600;letter-spacing:.03em;text-transform:uppercase;color:${MUTED};">{meta}</div>
<div style="margin-top:18px;height:1px;background:${LINE};line-height:1px;font-size:0;">&nbsp;</div>
</td></tr>

`
      : ""
  }<tr><td style="padding:${withTicket ? "4px" : "24px"} 24px 0 24px;font-family:${SANS};font-size:15px;line-height:1.6;color:#44403c;">
{body}
</td></tr>

${
  withTicket
    ? `<tr><td style="padding:18px 24px 26px 24px;">
<a href="{link}" style="display:inline-block;background:{brand};color:{ink};font-family:${SANS};font-size:14px;font-weight:700;text-decoration:none;padding:11px 20px;border-radius:10px;">${escapeHtml(labels.openTicket)}</a>
</td></tr>

`
    : ""
}<tr><td style="padding:16px 24px 20px 24px;border-top:1px solid ${LINE};font-family:${SANS};font-size:12px;line-height:1.6;color:${FAINT};">
${withSignature ? `<div style="color:${MUTED};margin-bottom:8px;">{signature}</div>\n` : ""}${labels.replyHint && withReply ? `${escapeHtml(labels.replyHint)}<br>\n` : ""}{desk} &middot; <a href="{deskUrl}" style="color:${FAINT};text-decoration:underline;">{deskHost}</a>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

/**
 * The whole document, ready to hand to a mail server.
 *
 * `layout` is the desk's own when it has taken one over, and the shipped one
 * otherwise. Both go through the same filling-in, which is what stops an edited
 * layout and the default drifting into two different renderers.
 */
export function mailDocument({
  content,
  preheader,
  values,
  brandColor,
  withTicket,
  signature,
  subject,
  labels,
  layout,
}: Chrome) {
  const brand = /^#[0-9a-fA-F]{6}$/.test(brandColor) ? brandColor : "#febe2e";
  const deskUrl = values["desk.url"] ?? "";
  const link = values["ticket.url"] ?? "";

  const shape: LayoutShape = {
    withTicket,
    withReply: Boolean(labels.replyAbove),
    withSignature: Boolean(signature),
    labels: { openTicket: labels.openTicket, replyHint: labels.replyHint },
  };

  const parts: LayoutParts = {
    body: content,
    subject: subject ?? values["ticket.reference"] ?? values["desk.name"] ?? "",
    preheader,
    signature: signature ? escapeHtml(signature).replace(/\n/g, "<br>") : "",
    reference: values["ticket.reference"] ?? "",
    title: values["ticket.title"] ?? "",
    meta: [values["ticket.status"], values["ticket.priority"], values["ticket.type"]]
      .filter(Boolean)
      .join(" · "),
    link,
    marker: labels.replyAbove ? replyMarker(labels.replyAbove) : "",
    desk: values["desk.name"] ?? "",
    deskUrl,
    deskHost: deskUrl.replace(/^https?:\/\//, ""),
    brand,
    ink: inkOn(brand),
  };

  return renderLayout(layout || shippedLayout(shape), parts, values);
}

/**
 * The same message for a client that will not draw the other one.
 *
 * Not a stripped copy of the HTML — both are built from the same template and
 * the same values, so the plain half is a first-class message rather than the
 * wreckage of a layout. It ends the way the desk's mail has always ended: the
 * reference, then the link.
 *
 * Untouched by an edited layout, deliberately: a desk redrawing its HTML is
 * deciding what the laid-out half looks like, and the plain half has no layout
 * to redraw.
 */
export function plainDocument({
  content,
  values,
  withTicket,
  replyHint,
  replyAbove,
  signature,
}: {
  content: string;
  values: Record<string, string>;
  withTicket: boolean;
  replyHint: string;
  /// The sentence inside the reply marker, or empty where replies go nowhere.
  replyAbove: string;
  /// The desk's sign-off, already filled in. Empty on a desk that has not
  /// written one, which is the normal state.
  signature?: string;
}) {
  const foot = withTicket
    ? [values["ticket.reference"], values["ticket.url"]]
    : [values["desk.name"], values["desk.url"]];

  // The marker comes first, because a reply is typed above the quoted message
  // and the cut has to be above everything the client brought down with it.
  return [
    ...(replyAbove ? [replyMarker(replyAbove), ""] : []),
    content,
    "",
    ...(signature ? [signature, ""] : []),
    ...(replyHint ? [replyHint, ""] : []),
    "—",
    ...foot.filter(Boolean),
  ]
    .join("\n")
    .trim();
}
