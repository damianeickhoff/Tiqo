"use client";

import { Suspense, useCallback, useEffect, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BookText,
  FileText,
  FolderKanban,
  HardDrive,
  Ticket,
  UserRound,
} from "lucide-react";
import type { Messages } from "@/lib/i18n";
import {
  getServerVisits,
  getVisits,
  isBrowserBack,
  popVisit,
  previousVisit,
  recordVisit,
  setVisitTitle,
  subscribeVisits,
  type VisitKind,
} from "@/lib/nav-history";

const GLYPHS: Record<VisitKind, typeof Ticket> = {
  ticket: Ticket,
  document: BookText,
  asset: HardDrive,
  project: FolderKanban,
  person: UserRound,
  page: FileText,
};

/** What kind of thing a remembered page is, as one glyph. */
export function VisitGlyph({ kind, size = 14 }: { kind: VisitKind; size?: number }) {
  const Glyph = GLYPHS[kind];
  return <Glyph size={size} className="text-text-3" />;
}

/** The trail, live. */
export function useVisits() {
  return useSyncExternalStore(subscribeVisits, getVisits, getServerVisits);
}

/// The two desk pages that carry no metadata of their own, so the shell names
/// them rather than letting the trail remember them as "Tiqo".
const UNNAMED: Record<string, (t: Messages) => string> = {
  "/": (t) => t.nav.dashboard,
  "/settings": (t) => t.nav.settings,
};

function nameOfPage(pathname: string, t: Messages) {
  const own = document.title === "Tiqo" ? "" : document.title.replace(/ · Tiqo$/, "");
  return own || UNNAMED[pathname]?.(t) || "";
}

function Recorder({ t }: { t: Messages }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();

  useEffect(() => {
    const href = search ? `${pathname}?${search}` : pathname;
    recordVisit(href);

    // The route renders before its metadata resolves, so reading the title once
    // here would store the page you just left. Watching the head instead means
    // the name lands whenever it lands — and keeps up if the page renames
    // itself later, as a ticket does when its title is edited.
    // The observer of the page you are leaving can still fire — its callback is
    // a microtask and this effect's cleanup is not — so the address on screen,
    // not the one this effect was set up for, decides whose name this is.
    const name = () => {
      if (window.location.pathname + window.location.search !== href) return;
      setVisitTitle(href, nameOfPage(pathname, t));
    };
    name();
    const observer = new MutationObserver(name);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [pathname, search, t]);

  return null;
}

/**
 * Writes every desk route into the tab's trail.
 *
 * `useSearchParams` suspends on a statically rendered route; the desk has none,
 * but the boundary costs nothing and keeps a future one from failing the build.
 */
export function VisitRecorder({ t }: { t: Messages }) {
  return (
    <Suspense fallback={null}>
      <Recorder t={t} />
    </Suspense>
  );
}

/**
 * The way back to wherever you came from, named.
 *
 * A ticket opened from a document has no route home: the rail knows the sections,
 * not the page you were reading. This control is that route, and it says where it
 * goes, because "back" without a name is a guess.
 */
export function BackControl({ t }: { t: Messages }) {
  const router = useRouter();
  const visits = useVisits();
  const previous = previousVisit(visits);

  // Reads the trail rather than closing over it, so the key handler below can
  // be bound once and still act on where you are now.
  const back = useCallback(() => {
    const target = popVisit();
    if (!target) return;

    // When the trail and the browser agree on what is behind us, go back rather
    // than forward onto the same page: the browser's own Back button then still
    // means what the user expects, and no entry is added to undo.
    if (isBrowserBack(target.href)) router.back();
    else router.push(target.href);
  }, [router]);

  useEffect(() => {
    // Alt+← only. Backspace is a text key first and a navigation key second,
    // and the pages that bound it are the reason browsers stopped.
    function onKeyDown(event: KeyboardEvent) {
      if (!event.altKey || event.key !== "ArrowLeft" || event.metaKey || event.ctrlKey) return;
      if (!previousVisit(getVisits())) return;
      event.preventDefault();
      back();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [back]);

  if (!previous?.title) return null;

  return (
    <button
      type="button"
      onClick={back}
      title={t.nav.backTo(previous.title)}
      aria-label={t.nav.backTo(previous.title)}
      className="text-text-2 hover:bg-surface-3 hover:text-text rounded-control text-md inline-flex h-9 min-w-0 shrink items-center gap-1.5 px-2.5 font-medium transition-colors"
    >
      <ArrowLeft size={15} className="shrink-0" />
      <span className="hidden max-w-[10rem] truncate sm:inline lg:max-w-[16rem]">
        {previous.title}
      </span>
    </button>
  );
}
