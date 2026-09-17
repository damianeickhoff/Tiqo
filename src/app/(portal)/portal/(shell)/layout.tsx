import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { canUseDesk } from "@/lib/permissions";
import { THEME_COOKIE, readThemeChoice } from "@/lib/ui-preferences";
import { dateLocaleOf, getMessages, getSettings } from "@/lib/settings";
import { brandStyleSheet } from "@/lib/brand";
import { InstanceProvider } from "@/components/shell/instance-context";
import { getClock } from "@/lib/settings";
import { PortalHeader } from "@/components/portal/portal-header";
import { PortalClosed } from "@/components/portal/portal-closed";
import { NoticeBand } from "@/components/portal/portal-notice";
import { ApprovalBanner } from "@/components/portal/portal-approval-banner";
import { liveAnnouncements } from "@/lib/portal";

/**
 * The portal has its own shell on purpose. A requester is not a small operator:
 * they want one thing, they want it in three clicks, and every rail, filter and
 * queue in the desk is furniture they have to look past to find it.
 *
 * The guard lives in this group rather than one level up so that /portal/login
 * sits outside it. It did not, once — the layout wrapping the login page sent
 * every signed-out visitor to the page that redirected them straight back, and
 * the browser gave up with "too many redirects".
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const [user, settings, clock, t] = await Promise.all([
    getCurrentUser(),
    getSettings(),
    getClock(),
    getMessages(),
  ]);

  // Everything in this group needs an account. The login page is a sibling of
  // the group, not a child of it, so it never meets this line.
  if (!user) redirect("/portal/login");

  // A closed portal answers rather than bounces: it says why, in the words the
  // desk gave when it closed it.
  if (!settings.portalEnabled) {
    return (
      <PortalClosed
        locale={settings.locale}
        brandColor={settings.brandColor}
        title={settings.portalTitle}
        reason={settings.portalClosedReason}
        canUseDesk={canUseDesk(user)}
      />
    );
  }

  // The banner rides under the bar, on every page of the portal — which is
  // the whole difference between it and a notice on the front page.
  const banners = await liveAnnouncements(true);

  // Everything of theirs still running, counted once for the header. "Open"
  // here means the desk has not settled it — not the narrower set a status can
  // be flagged into for the front page, which is about what needs *them*.
  const openRequests = await prisma.ticket.count({
    where: { reporterId: user.id, status: { is: { settles: false } } },
  });

  // Three questions about approvals, out of one query: how many are waiting on
  // them, whether they have ever been asked at all — which is what decides
  // whether the portal has an Approvals section for this person — and which one
  // has been waiting longest, for the banner. Nobody is asked to sign off on
  // hundreds of things, so the rows themselves are cheaper than three round
  // trips on every page of the portal.
  const rounds = await prisma.approval.findMany({
    where: { approverId: user.id },
    orderBy: { createdAt: "asc" },
    select: { state: true, createdAt: true, ticket: { select: { reference: true, title: true } } },
  });

  const pending = rounds.filter((round) => round.state === "PENDING");
  const waitingApprovals = pending.length;
  const everAsked = rounds.length;
  const oldest = pending[0] ?? null;

  return (
    <InstanceProvider clock={clock} locale={settings.locale} dateLocale={dateLocaleOf(settings)}>
      <style dangerouslySetInnerHTML={{ __html: brandStyleSheet(settings.brandColor) }} />
      <div className="bg-bg flex min-h-dvh flex-col">
        <PortalHeader
          title={settings.portalTitle}
          user={{ name: user.name, email: user.email, avatarVariant: user.avatarVariant }}
          canSeeDesk={canUseDesk(user)}
          theme={readThemeChoice((await cookies()).get(THEME_COOKIE)?.value)}
          openRequests={openRequests}
          approvals={everAsked > 0 ? waitingApprovals : null}
        />

        {/* Under the bar, where a notice is read before anything else on the
            page and is still the portal's, not the browser's. The notices
            first, then the one thing waiting on this person: a change nobody
            can start because somebody has not answered is not something to
            find by wandering into a tab. */}
        {banners.map((banner) => (
          <NoticeBand
            key={banner.id}
            title={banner.title}
            body={banner.body}
            tone={banner.tone}
            endsAt={banner.endsAt}
            locale={dateLocaleOf(settings)}
          />
        ))}
        {oldest ? (
          <ApprovalBanner
            waitingSince={oldest.createdAt}
            title={oldest.ticket.title}
            reference={oldest.ticket.reference}
          />
        ) : null}

        <main className="flex-1">{children}</main>

        <footer className="portal-wrap flex h-[72px] items-center gap-4 text-sm">
          <span className="text-text-3">{settings.portalTitle}</span>
          {/* The way back to the desk is only shown to someone who has one. */}
          {canUseDesk(user) ? (
            <>
              <span className="text-text-3">·</span>
              <Link href="/" className="text-text-2 hover:text-text transition-colors">
                {t.portal.toTheDesk}
              </Link>
            </>
          ) : null}
        </footer>
      </div>
    </InstanceProvider>
  );
}
