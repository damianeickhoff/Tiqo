"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, EyeOff, ExternalLink, X } from "lucide-react";
import { PanelCard } from "@/components/tickets/panel-card";
import { useDateFormat, useMessages } from "@/components/shell/instance-context";
import { formatSize } from "@/lib/attachments";
import { cn } from "@/lib/utils";

/** Every file on the ticket, whichever half of the page it arrived through. */
export type TicketFile = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: Date;
  uploadedBy: { name: string } | null;
  /// Whether it came in on an internal note. Only ever true for somebody who
  /// may read those — the query never hands the others over — and said on the
  /// row so nobody forwards a screenshot they thought the requester had seen.
  internal: boolean;
};

const isImage = (file: TicketFile) => file.mimeType.startsWith("image/");

/**
 * Everything attached to this ticket, in one place.
 *
 * The conversation already shows each file beside the message that carried it,
 * which answers "what came with this reply" and nothing else. The question this
 * card answers is the other one — "where is that screenshot" — on a ticket
 * whose thread is forty messages long. Newest first, because the file somebody
 * is looking for is nearly always the last one in.
 *
 * Nothing is uploaded or removed from here: this is a way to find a file, and
 * the place a file is taken off is the message it belongs to, where whoever is
 * removing it can see what it was attached to.
 */
export function FilesCard({ files }: { files: TicketFile[] }) {
  const t = useMessages();
  const when = useDateFormat({ day: "numeric", month: "short" });

  const images = files.filter(isImage);
  const [lightbox, setLightbox] = useState<number | null>(null);

  return (
    <PanelCard title={t.ticket.filesTitle}>
      {files.length === 0 ? (
        <p className="text-text-3 px-3.5 py-3 text-base">{t.ticket.filesNone}</p>
      ) : (
        <ul className="divide-line divide-y">
          {files.map((file) => {
            const at = images.indexOf(file);

            return (
              <li key={file.id}>
                {/* A picture opens where it is; anything else is a download,
                    because a browser asked to render a zip does nothing useful
                    with it. Both are the same row either way. */}
                <FileRow
                  file={file}
                  onOpen={at === -1 ? null : () => setLightbox(at)}
                  line={[
                    formatSize(file.size),
                    file.uploadedBy ? t.ticket.uploadedBy(file.uploadedBy.name) : null,
                    when.format(file.createdAt),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                />
              </li>
            );
          })}
        </ul>
      )}

      {lightbox !== null && images[lightbox] ? (
        <Lightbox
          images={images}
          at={lightbox}
          onMove={setLightbox}
          onClose={() => setLightbox(null)}
        />
      ) : null}
    </PanelCard>
  );
}

/** One file: a thumbnail where there is a picture to show, a name where not. */
function FileRow({
  file,
  line,
  onOpen,
}: {
  file: TicketFile;
  line: string;
  onOpen: (() => void) | null;
}) {
  const t = useMessages();

  const inside = (
    <>
      {isImage(file) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/files/${file.id}`}
          alt=""
          className="border-line bg-surface-2 rounded-control h-9 w-12 shrink-0 border object-cover"
        />
      ) : (
        <span className="border-line bg-surface-2 rounded-control text-text-3 flex h-9 w-12 shrink-0 items-center justify-center border font-mono text-[10px] uppercase">
          {file.filename.split(".").pop()?.slice(0, 4)}
        </span>
      )}

      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-base">{file.filename}</span>
        <span className="text-text-3 block truncate text-sm">{line}</span>
      </span>

      {/* Said on the row rather than left to be remembered: a file from an
          internal note is not one the requester has ever seen. */}
      {file.internal ? (
        <EyeOff size={13} className="text-text-3 shrink-0" aria-label={t.ticket.filesInternal} />
      ) : null}
    </>
  );

  const shape = "hover:bg-surface-2 flex w-full items-center gap-2.5 px-3.5 py-2 transition-colors";

  return onOpen ? (
    <button type="button" onClick={onOpen} title={file.filename} className={cn(shape, "text-left")}>
      {inside}
    </button>
  ) : (
    <a href={`/api/files/${file.id}`} title={file.filename} className={shape}>
      {inside}
    </a>
  );
}

/**
 * One picture, big, with the ticket's others either side of it.
 *
 * Its own overlay rather than the app's dialog: a lightbox is a picture on a
 * dim ground, and a titled panel with padding around it is the thing somebody
 * opened the picture to get away from. Arrow keys work, because a screenshot
 * is rarely looked at alone — the one before it is usually the same screen a
 * minute earlier.
 */
function Lightbox({
  images,
  at,
  onMove,
  onClose,
}: {
  images: TicketFile[];
  at: number;
  onMove: (next: number) => void;
  onClose: () => void;
}) {
  const t = useMessages();
  const current = images[at]!;

  // Wraps, because a gallery that stops at the end makes somebody walk back
  // through it to see the first one again.
  const step = useCallback(
    (by: number) => onMove((at + by + images.length) % images.length),
    [at, images.length, onMove],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, step]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={current.filename}
    >
      <button
        type="button"
        aria-label={t.common.closeDialog}
        tabIndex={-1}
        onClick={onClose}
        className="animate-fade absolute inset-0 cursor-default bg-[rgba(20,18,16,0.82)] backdrop-blur-[2px]"
      />

      <div className="relative flex min-h-0 flex-1 items-center justify-center p-4 sm:p-10">
        {images.length > 1 ? (
          <Arrow side="left" label={t.ticket.filesPrevious} onClick={() => step(-1)} />
        ) : null}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/files/${current.id}`}
          alt={current.filename}
          className="animate-rise max-h-full max-w-full rounded-lg object-contain shadow-[var(--shadow-lg)]"
        />

        {images.length > 1 ? (
          <Arrow side="right" label={t.ticket.filesNext} onClick={() => step(1)} />
        ) : null}
      </div>

      {/* The caption carries the two things a picture cannot say about itself:
          what it is called, and which of how many it is. */}
      <div className="relative flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 pb-5 text-center">
        <span className="text-sm text-white/90">{current.filename}</span>
        {images.length > 1 ? (
          <span className="font-mono text-xs text-white/60">
            {t.ticket.filesPosition(at + 1, images.length)}
          </span>
        ) : null}
        <a
          href={`/api/files/${current.id}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-sm text-white/70 transition-colors hover:text-white"
        >
          <ExternalLink size={12} />
          {t.ticket.filesOpen}
        </a>
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label={t.common.closeDialog}
        className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
      >
        <X size={18} />
      </button>
    </div>,
    document.body,
  );
}

function Arrow({
  side,
  label,
  onClick,
}: {
  side: "left" | "right";
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "absolute top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full",
        "text-white/70 transition-colors hover:bg-white/10 hover:text-white",
        side === "left" ? "left-2 sm:left-4" : "right-2 sm:right-4",
      )}
    >
      {side === "left" ? <ChevronLeft size={22} /> : <ChevronRight size={22} />}
    </button>
  );
}
