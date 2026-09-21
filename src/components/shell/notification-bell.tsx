"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/actions/notifications";
import type { Notice } from "@/lib/notifications";
import { Avatar } from "@/components/avatar";
import { useMessages } from "@/components/shell/instance-context";
import { shortAge } from "@/lib/tickets";
import { docHref } from "@/lib/docs";
import { cn } from "@/lib/utils";
import type { Messages } from "@/lib/i18n";

/**
 * The bell.
 *
 * Its count arrives with the page and is pushed after that: an open stream to
 * /api/live, woken by the database itself the moment a notification is written
 * for this person. Nothing is on a timer, and a tab left open all afternoon
 * asks nothing at all until there is something to say.
 *
 * The stream carries no content, only "something happened" — the rows still
 * come through the same action the bell has always used, so who may read what
 * is decided in one place.
 *
 * Anything genuinely new also raises a desktop notification, once permission
 * has been given. Permission is asked for on the first click of the bell — a
 * real gesture, which is both what browsers require and what makes the prompt
 * make sense.
 */
export function NotificationBell({
  initialNotices,
  initialUnread,
}: {
  initialNotices: Notice[];
  initialUnread: number;
}) {
  const t = useMessages();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  /// Ids already announced to the desktop, so a poll cannot repeat itself.
  const announced = useRef<Set<string> | null>(null);

  /**
   * The page is the source of truth: every navigation brings a fresh count.
   * What the bell has learned since — a refetch, a row just read — is held
   * beside the props it was learned against, so the next page's data replaces
   * it rather than being overwritten by it. No effect syncs the two.
   */
  const [local, setLocal] = useState<{
    from: Notice[];
    notices: Notice[];
    unread: number;
  } | null>(null);

  const view =
    local?.from === initialNotices ? local : { notices: initialNotices, unread: initialUnread };
  const { notices, unread } = view;

  const update = (next: { notices?: Notice[]; unread?: number }) =>
    setLocal({
      from: initialNotices,
      notices: next.notices ?? notices,
      unread: next.unread ?? unread,
    });

  // Everything already on screen counts as seen: the first poll after a page
  // load must not announce the backlog the page arrived with.
  if (announced.current === null) {
    announced.current = new Set(initialNotices.map((notice) => notice.id));
  }

  /** Ring the desktop for rows this session has not announced before. */
  function announce(fresh: Notice[]) {
    const seen = announced.current!;
    const fresh_ = fresh.filter((notice) => !notice.readAt && !seen.has(notice.id));
    for (const notice of fresh) seen.add(notice.id);

    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

    for (const notice of fresh_.slice(0, 3)) {
      const about = subject(notice);
      // The same sentence the list shows, rather than a second copy of the
      // mapping that has to be kept in step with it.
      const body = sentence(notice, t);
      const popup = new Notification(`${about.label} · ${about.title}`, {
        body,
        tag: notice.id,
        icon: "/pwa-icon/192",
      });
      popup.onclick = () => {
        window.focus();
        router.push(about.href);
        popup.close();
      };
    }
  }

  // One open stream for the life of the page. EventSource reconnects by itself
  // after a sleep or a dropped network, and the "open" event it is greeted with
  // doubles as the catch-up: whatever arrived while it was away is picked up on
  // the way back in.
  useEffect(() => {
    let live = true;
    const source = new EventSource("/api/live");

    source.onmessage = async () => {
      const fresh = await listNotifications();
      if (!live) return;
      announce(fresh.notices);
      setLocal({ from: initialNotices, notices: fresh.notices, unread: fresh.unread });
    };

    return () => {
      live = false;
      source.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- announce reads refs and props that are stable for the life of a page
  }, [initialNotices]);

  useEffect(() => {
    if (!open) return;

    let live = true;
    listNotifications().then((fresh) => {
      if (!live) return;
      announce(fresh.notices);
      setLocal({ from: initialNotices, notices: fresh.notices, unread: fresh.unread });
    });

    function onPointerDown(event: PointerEvent) {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);

    return () => {
      live = false;
      document.removeEventListener("pointerdown", onPointerDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- as above
  }, [open, initialNotices]);

  function openNotice(notice: Notice) {
    setOpen(false);
    if (!notice.readAt) {
      update({
        unread: Math.max(0, unread - 1),
        notices: notices.map((row) =>
          row.id === notice.id ? { ...row, readAt: new Date() } : row,
        ),
      });
      void markNotificationRead(notice.id);
    }
    router.push(subject(notice).href);
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => {
          // The click is the gesture browsers want before they will ask.
          if (typeof Notification !== "undefined" && Notification.permission === "default") {
            void Notification.requestPermission();
          }
          setOpen((current) => !current);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={unread > 0 ? t.notifications.unreadCount(unread) : t.notifications.title}
        className="bg-surface-2 hover:bg-surface-3 text-text-2 hover:text-text relative flex size-9 items-center justify-center rounded-full transition-colors"
      >
        <Bell size={17} />
        {unread > 0 ? (
          <span className="bg-negative tnum absolute top-0.5 right-0.5 flex min-w-[16px] items-center justify-center rounded-full px-1 text-xs leading-[16px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="animate-rise bg-surface rounded-card absolute top-full right-0 z-50 mt-2 w-[min(22rem,90vw)] overflow-hidden shadow-[var(--shadow-float)]">
          <div className="border-border-soft flex items-center justify-between gap-3 border-b px-4 py-2.5">
            <p className="text-base font-semibold">{t.notifications.title}</p>
            {unread > 0 ? (
              <button
                type="button"
                onClick={() => {
                  update({
                    unread: 0,
                    notices: notices.map((notice) => ({
                      ...notice,
                      readAt: notice.readAt ?? new Date(),
                    })),
                  });
                  void markAllNotificationsRead();
                }}
                className="text-text-3 hover:text-text text-sm font-medium transition-colors"
              >
                {t.notifications.markAllRead}
              </button>
            ) : null}
          </div>

          {notices.length === 0 ? (
            <p className="text-text-3 px-4 py-8 text-center text-base">{t.notifications.empty}</p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto p-1.5">
              {notices.map((notice) => (
                <li key={notice.id}>
                  <button
                    type="button"
                    onClick={() => openNotice(notice)}
                    className={cn(
                      "rounded-control flex w-full items-start gap-2.5 px-2.5 py-2 text-left transition-colors",
                      notice.readAt ? "hover:bg-surface-2" : "bg-[var(--brand-tint)]",
                    )}
                  >
                    {notice.actor ? (
                      <Avatar
                        name={notice.actor.name}
                        variant={notice.actor.avatarVariant}
                        size={26}
                      />
                    ) : (
                      <span className="border-border size-[26px] shrink-0 rounded-full border border-dashed" />
                    )}

                    <span className="min-w-0 flex-1">
                      <span className="block text-base leading-snug">{sentence(notice, t)}</span>
                      <span className="text-text-3 mt-0.5 flex items-center gap-1.5 text-xs">
                        <span className="font-mono">{subject(notice).label}</span>
                        <span aria-hidden>·</span>
                        {t.common.ago(shortAge(new Date(notice.createdAt), undefined, t))}
                      </span>
                    </span>

                    {notice.readAt ? null : (
                      <span aria-hidden className="bg-brand mt-1.5 size-2 shrink-0 rounded-full" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Link
            href="/tickets?assignee=me&open=1"
            onClick={() => setOpen(false)}
            className="border-border-soft text-text-2 hover:bg-surface-2 hover:text-text block border-t px-4 py-2.5 text-center text-base font-medium transition-colors"
          >
            {t.notifications.seeYourTickets}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

/**
 * What a notice is about.
 *
 * A notice points at one thing, and which of the two it is depends on where the
 * event happened — a mention written in a project's conversation has no ticket
 * behind it.
 */
function subject(notice: Notice) {
  if (notice.ticket) {
    return {
      label: notice.ticket.reference,
      title: notice.ticket.title,
      href: `/tickets/${notice.ticket.number}`,
    };
  }
  if (notice.project) {
    return {
      label: notice.project.key,
      title: notice.project.name,
      href: `/projects/${notice.project.key}`,
    };
  }
  if (notice.doc) {
    return {
      label: notice.doc.space.key,
      title: notice.doc.title,
      href: docHref(notice.doc.space.key, notice.doc.slug),
    };
  }
  return { label: "", title: "", href: "/" };
}

/** One whole sentence per kind: the actor sits in a different place in Dutch. */
function sentence(notice: Notice, t: Messages) {
  const who = notice.actor?.name ?? t.notifications.someone;
  const { title } = subject(notice);

  if (notice.kind === "ASSIGNED") return t.notifications.assigned(who, title);
  if (notice.kind === "FORWARDED") return t.notifications.forwarded(who, title);
  if (notice.kind === "MENTIONED") return t.notifications.mentioned(who, title);
  if (notice.kind === "APPROVAL_REQUESTED") return t.notifications.approvalRequested(who, title);
  if (notice.kind === "APPROVAL_DECIDED") return t.notifications.approvalDecided(who, title);
  if (notice.kind === "RAISED") return t.notifications.raised(who, title);
  if (notice.kind === "BLOCKED") return t.notifications.blocked(who, title);
  if (notice.kind === "DOC_EDITED") return t.notifications.docEdited(who, title);
  // No actor: the desk noticed the date, nobody did anything.
  if (notice.kind === "DOC_STALE") return t.notifications.docStale(title);
  return t.notifications.commented(who, title);
}
