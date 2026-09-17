"use client";

import {
  FileArchive,
  FileAudio,
  FileCode2,
  FileSpreadsheet,
  FileText,
  FileVideo,
  X,
  type LucideIcon,
} from "lucide-react";
import { deleteAttachment } from "@/lib/actions/attachments";
import { ConfirmDelete } from "@/components/confirm-delete";
import { useDateFormat, useMessages } from "@/components/shell/instance-context";
import { formatSize, isShownInBody } from "@/lib/attachments";

export type AttachmentRow = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: Date;
  uploadedById: string | null;
  uploadedBy: { name: string } | null;
};

/**
 * What kind of thing a file is, at a glance.
 *
 * Six shapes rather than one paper icon on everything: the question a list of
 * attachments answers is "which of these is the log and which is the invoice",
 * and a column of identical icons answers it with the filename alone. Broad on
 * purpose — a precise icon per mime type is a lookup table nobody maintains.
 */
function glyphFor(mimeType: string): LucideIcon {
  const type = mimeType.toLowerCase();
  if (type.startsWith("video/")) return FileVideo;
  if (type.startsWith("audio/")) return FileAudio;
  if (/zip|compressed|tar|rar|7z/.test(type)) return FileArchive;
  if (/sheet|excel|csv/.test(type)) return FileSpreadsheet;
  if (/json|xml|javascript|typescript|x-sh|x-yaml/.test(type)) return FileCode2;
  return FileText;
}

/**
 * The files on a comment or a ticket.
 *
 * An image is drawn rather than listed: the whole point of attaching a
 * screenshot is that somebody can see it without saving it first. Everything
 * else is a row that says who put it there and when — a zip called `export.zip`
 * on a ticket three people have worked is otherwise a file nobody will own.
 */
export function AttachmentList({
  attachments,
  viewerId,
  canModerate,
  body,
}: {
  attachments: AttachmentRow[];
  viewerId: string;
  canModerate: boolean;
  /// What was written, when there is any. A picture the writer placed in the
  /// text is already on the page; repeating it underneath says the same thing
  /// twice and makes the list a poor answer to "what came with this".
  body?: string;
}) {
  const t = useMessages();
  const when = useDateFormat({ day: "numeric", month: "short" });

  const listed = body ? attachments.filter((file) => !isShownInBody(body, file.id)) : attachments;
  if (!listed.length) return null;

  const images = listed.filter((file) => file.mimeType.startsWith("image/"));
  const rest = listed.filter((file) => !file.mimeType.startsWith("image/"));
  const mine = (file: AttachmentRow) => canModerate || file.uploadedById === viewerId;

  return (
    <div className="mt-3 space-y-2">
      {images.length ? (
        <ul className="flex flex-wrap gap-2">
          {images.map((file) => (
            <li key={file.id} className="relative">
              <a
                href={`/api/files/${file.id}`}
                target="_blank"
                rel="noreferrer"
                title={
                  file.uploadedBy
                    ? `${file.filename} · ${t.ticket.uploadedBy(file.uploadedBy.name)}`
                    : file.filename
                }
                className="border-line bg-surface-2 hover:border-line-strong rounded-card block overflow-hidden border transition-colors"
              >
                {/* The tile is a fixed size so a thread of screenshots reads as
                    a row of thumbnails — but the picture is contained rather
                    than cropped, because the part of a screenshot somebody
                    meant to show is as often at an edge as in the middle. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/files/${file.id}`}
                  alt={file.filename}
                  className="h-28 w-40 object-contain"
                />
              </a>
              {mine(file) ? <Remove id={file.id} filename={file.filename} floating /> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {rest.length ? (
        <ul className="space-y-1">
          {rest.map((file) => {
            const Glyph = glyphFor(file.mimeType);
            return (
              <li key={file.id} className="flex items-center gap-2">
                <a
                  href={`/api/files/${file.id}`}
                  className="border-line bg-surface-2 hover:border-line-strong text-text-2 hover:text-text rounded-control flex min-w-0 flex-1 items-center gap-2.5 border px-2.5 py-1.5 text-base transition-colors"
                >
                  <Glyph size={15} className="text-text-3 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{file.filename}</span>
                    <span className="text-text-3 block truncate text-sm">
                      {[
                        formatSize(file.size),
                        file.uploadedBy ? t.ticket.uploadedBy(file.uploadedBy.name) : null,
                        when.format(file.createdAt),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </a>
                {mine(file) ? <Remove id={file.id} filename={file.filename} /> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Taking a file off again.
 *
 * Visible rather than revealed on hover: hover is not something a phone has,
 * and a control nobody can reach on half the devices the portal is read on is
 * not a control. What protects the click is the dialog it opens, not the
 * difficulty of finding it.
 */
function Remove({
  id,
  filename,
  floating = false,
}: {
  id: string;
  filename: string;
  floating?: boolean;
}) {
  const m = useMessages();

  return (
    <ConfirmDelete title={m.common.deleteThing(filename)} run={() => deleteAttachment(id)}>
      {(ask) => (
        <button
          type="button"
          onClick={ask}
          title={m.ticket.removeFile}
          aria-label={m.ticket.removeFile}
          className={
            "text-text-3 hover:text-negative inline-flex h-6 w-6 shrink-0 items-center justify-center " +
            "rounded-full transition-colors " +
            // On a thumbnail it sits over somebody's picture, so it brings its
            // own ground: a bare glyph disappears on anything pale.
            (floating
              ? "bg-surface/85 border-line absolute top-1 right-1 border shadow-[var(--highlight)] backdrop-blur-sm"
              : "")
          }
        >
          <X size={12} />
        </button>
      )}
    </ConfirmDelete>
  );
}
