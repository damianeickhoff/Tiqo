import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canViewDocs, canViewTicket, canWriteInternalNote } from "@/lib/permissions";
import { readUpload, uploadSize } from "@/lib/files";
import { isInlineType } from "@/lib/attachments";

export const runtime = "nodejs";

/** Every refusal is a 404. A 403 tells whoever is guessing that they guessed a
 *  real id, which is half of what they wanted to know. */
const gone = () => new Response("Not found", { status: 404 });

/**
 * Hands back one attachment, to someone allowed to have it.
 *
 * Files are not served from `public/` for exactly this reason: an attachment on
 * an internal note must not be readable by the requester that note is about,
 * and a file under `public/` is readable by the whole internet.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) return gone();

  const attachment = await prisma.attachment.findUnique({
    where: { id },
    select: {
      id: true,
      filename: true,
      mimeType: true,
      size: true,
      ticket: { select: { reporterId: true, assigneeId: true } },
      doc: { select: { id: true } },
      comment: { select: { isInternal: true } },
    },
  });
  if (!attachment) return gone();

  // Whatever the file hangs from is what says who may read it. A file on a
  // document answers to the documentation permission; one on a ticket answers
  // to the ticket; and a row hanging from neither is a row that should not
  // exist, so it is refused rather than guessed at.
  if (attachment.doc) {
    if (!canViewDocs(user)) return gone();
  } else if (attachment.ticket) {
    if (!canViewTicket(user, attachment.ticket)) return gone();
    // And a file on an internal note is internal, because the note is.
    if (attachment.comment?.isInternal && !canWriteInternalNote(user)) return gone();
  } else {
    return gone();
  }

  // The row says how big the file is; the disk is what actually has to answer
  // for it. A row whose bytes are gone is a missing file, not a short one.
  const size = await uploadSize(attachment.id);
  if (size === null) return gone();

  // The name is user input, so it never reaches the header raw: ASCII-safe for
  // old clients, percent-encoded UTF-8 for everything since.
  const fallback = attachment.filename.replace(/[^\w.\- ]+/g, "_");
  const encoded = encodeURIComponent(attachment.filename);
  const disposition = isInlineType(attachment.mimeType) ? "inline" : "attachment";

  return new Response(readUpload(attachment.id), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Length": String(size),
      "Content-Disposition": `${disposition}; filename="${fallback}"; filename*=UTF-8''${encoded}`,
      // The second lock on the same door `isInlineType` bolts. Everything this
      // route refuses to show inline — an SVG, an HTML file, anything the mime
      // type is lying about — is a document if a browser opens it anyway, and
      // sandboxing it means a document of its own origin with no script and no
      // reach into ours. Not set on the inline half, because `sandbox` also
      // turns off the built-in PDF viewer and a PDF that downloads instead of
      // opening is the preview this feature exists to give.
      ...(disposition === "attachment" ? { "Content-Security-Policy": "sandbox" } : {}),
      // The mime type came from the browser that uploaded it, so the browser
      // reading it must not be allowed to reconsider.
      "X-Content-Type-Options": "nosniff",
      // Never stored. Permission is checked per request, so a cached copy is a
      // copy that outlives the permission: sign out on a shared machine and the
      // browser would still hand the file back from disk. A file is worth one
      // request each time it is looked at.
      "Cache-Control": "no-store, private",
    },
  });
}
