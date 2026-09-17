import type { Messages } from "@/lib/i18n";

/**
 * What a file may be, and how to say it — the half of attachments that is safe
 * on the client. Everything that touches the disk lives in `src/lib/files.ts`,
 * which is `server-only` and therefore cannot be imported by the components
 * that draw the things.
 */

/** A file may be this big, and one comment or ticket may carry this many.
 *  There is no type allowlist: an extension list blocks the log file somebody
 *  actually needed and stops no attacker. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_UPLOAD_COUNT = 10;

/** The files a form actually carried. An empty file input still submits an
 *  entry, so the zero-length ones are dropped rather than stored. */
export function uploadsFrom(formData: FormData): File[] {
  return formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

/** Why these cannot be accepted, in the desk's language — or null. Checked
 *  before anything is written, so a rejected post leaves nothing behind. */
export function uploadProblem(files: File[], t: Messages): string | null {
  if (files.length > MAX_UPLOAD_COUNT) return t.errors.tooManyFiles(MAX_UPLOAD_COUNT);

  const tooBig = files.find((file) => file.size > MAX_UPLOAD_BYTES);
  if (tooBig) return t.errors.fileTooLarge(tooBig.name, MAX_UPLOAD_BYTES / (1024 * 1024));

  // The same ceiling for the whole post, because that is what the request body
  // is held to: two files each just under the limit are refused by the
  // framework before any of this runs, as a stack trace nobody can read.
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > MAX_UPLOAD_BYTES) return t.errors.filesTooLarge(MAX_UPLOAD_BYTES / (1024 * 1024));

  return null;
}

/**
 * Whether this can be shown rather than downloaded. Images because a screenshot
 * nobody can see without saving it defeats the point of attaching one, and PDFs
 * because every browser has a reader.
 *
 * SVG is the exception, and it is not a close call: an SVG is a document that
 * may carry script, and one shown inline runs that script on the app's own
 * origin with the reader's session. Anyone who can attach a file could then
 * read anything that reader can — and since mail can attach files, that is
 * anyone at all. Downloading it costs a click and closes the hole.
 */
export function isInlineType(mimeType: string) {
  const type = mimeType.toLowerCase().split(";")[0]!.trim();
  if (type === "image/svg+xml" || type === "image/svg") return false;

  return type.startsWith("image/") || type === "application/pdf";
}

/**
 * What a picture in a draft points at before its file has an address.
 *
 * The composer places `![name](attachment:<key>)` because nothing is uploaded
 * until the form is submitted, so there is no id to write yet. This is the only
 * place that shape is defined, and both the writer of the token and the reader
 * of it come here for it.
 */
const DRAFT_IMAGE = /!\[([^\]]*)\]\(attachment:([A-Za-z0-9-]+)\)/g;

/**
 * Swaps the draft tokens in a body for the addresses the files ended up at.
 *
 * The keys arrive alongside the files and in the same order, so the key's
 * position is the file's position. A token naming a key that was not submitted
 * — a picture inlined and then taken off the list again — loses its picture and
 * keeps its words: a broken image in a ticket is a thing nobody can explain
 * later, and the filename at least says what was meant.
 */
export function resolveDraftImages(body: string, keys: string[], ids: string[]) {
  if (!body.includes("attachment:")) return body;

  return body.replace(DRAFT_IMAGE, (_whole, alt: string, key: string) => {
    const id = ids[keys.indexOf(key)];
    return id ? `![${alt}](/api/files/${id})` : alt;
  });
}

/** Whether a body shows this file itself, in which case listing it underneath
 *  as well would be saying the same thing twice. */
export function isShownInBody(body: string, attachmentId: string) {
  return body.includes(`/api/files/${attachmentId}`);
}

/** Bytes as somebody would say them. */
export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
