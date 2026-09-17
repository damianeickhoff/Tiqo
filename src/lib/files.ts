import "server-only";

import { createReadStream } from "node:fs";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";

import { prisma } from "@/lib/prisma";

/**
 * Where uploaded files live.
 *
 * On disk rather than in Postgres: a desk that already mounts a volume for the
 * database can mount one more, and bytes in a database make every backup
 * enormous and every row read expensive. There is no storage abstraction over
 * this — Tiqo runs on one box, and a filesystem path is the whole of it.
 */
export function filesDir() {
  return path.resolve(process.env.TIQO_FILES_DIR ?? "./var/files");
}

/**
 * Where one attachment's bytes sit.
 *
 * Named after the row id and never after what the browser called the file: a
 * filename is user input, and user input in a path is a traversal waiting to
 * happen. Sharded on the first two characters because one flat directory
 * holding fifty thousand files is a directory nobody can list.
 */
function pathFor(id: string) {
  // Ids come from the database, so this can only fail if something has gone
  // very wrong upstream — which is exactly when it is worth failing loudly.
  if (!/^[a-z0-9]+$/i.test(id)) throw new Error("bad attachment id");
  return path.join(filesDir(), id.slice(0, 2), id);
}

/** For the download route. Streams, so a 25 MB file is not read into memory to
 *  be handed straight back out again. */
export function readUpload(id: string): ReadableStream<Uint8Array> {
  return Readable.toWeb(createReadStream(pathFor(id))) as ReadableStream<Uint8Array>;
}

/**
 * How many bytes are actually there, or null if the file is not.
 *
 * Asked before the headers go out. The stream is lazy, so bytes that have been
 * restored around, deleted by hand or never written would otherwise be a 200
 * with a Content-Length the response never meets — which browsers show as a
 * truncated file rather than as the missing one it is.
 */
export async function uploadSize(id: string) {
  try {
    return (await stat(pathFor(id))).size;
  } catch {
    return null;
  }
}

/**
 * Rows cascade with their parent; bytes do not. Every deletion comes through
 * here, and a file that is already gone is the outcome asked for rather than an
 * error worth reporting.
 */
export async function removeUpload(id: string) {
  try {
    await unlink(pathFor(id));
  } catch {
    // Already gone.
  }
}

/** What a file hangs from: a ticket, optionally narrowed to one reply, or a
 *  document. Exactly one of the two, because the parent is what decides who may
 *  read the bytes. */
export type UploadParent = { ticketId: string; commentId?: string } | { docId: string };

/**
 * Stores the files a form carried, against the ticket and — when they came in
 * with a reply — against that comment too.
 *
 * Rows first, then bytes, and anything already written is undone if one of them
 * fails: a row pointing at a file that is not there is worse than no attachment
 * at all, because it is a broken link nobody can explain.
 *
 * Returns the ids in the order the files arrived, so a picture placed in the
 * body can be matched to the file it was drawn from. Empty means it did not get
 * through.
 */
export async function saveUploads(files: File[], parent: UploadParent, uploadedById: string) {
  const written: string[] = [];

  try {
    for (const file of files) {
      const row = await prisma.attachment.create({
        data: {
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          uploadedById,
          ...parent,
        },
        select: { id: true },
      });
      written.push(row.id);
      // The whole request body is already in memory by the time an action runs,
      // so streaming from it would save nothing.
      await writeFile(await ensureDir(row.id), Buffer.from(await file.arrayBuffer()));
    }
    return written;
  } catch (error) {
    // The caller turns an empty answer into a sentence for whoever posted the
    // form; what actually went wrong — a full disk, a read-only volume — is
    // only ever visible here.
    console.error(`[files] could not store an upload: ${String(error)}`);
    await Promise.all(written.map(removeUpload));
    await prisma.attachment.deleteMany({ where: { id: { in: written } } });
    return [];
  }
}

/**
 * Unlinks the bytes behind attachments that are about to be cascaded away with
 * whatever they hang from.
 *
 * Prisma takes the rows when a ticket or a comment goes; nothing takes the
 * files, and a directory that only ever grows is the kind of problem that
 * surfaces a year later as a full disk. Call it before the parent is deleted,
 * while the rows are still there to be read.
 */
export async function purgeUploads(
  where: { ticketId: string } | { docId: string } | { commentId: { in: string[] } },
) {
  const rows = await prisma.attachment.findMany({ where, select: { id: true } });
  await Promise.all(rows.map((row) => removeUpload(row.id)));
}

async function ensureDir(id: string) {
  const target = pathFor(id);
  await mkdir(path.dirname(target), { recursive: true });
  return target;
}
