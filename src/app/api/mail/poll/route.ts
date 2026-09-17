import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { drainOutbox, reason } from "@/lib/mail";
import { drainInbox } from "@/lib/mail-inbox";
import { sweepStaleDocs } from "@/lib/doc-sweep";

export const runtime = "nodejs";
/** Never cached, never prerendered: it is a verb. */
export const dynamic = "force-dynamic";

/**
 * The clock this feature does not have.
 *
 * Next has no background worker and this project is not growing a process model
 * for one, so the queue is drained by whatever already runs on a schedule on
 * the box — a cron entry, a systemd timer, an Unraid user script. The README
 * has the line to copy.
 *
 * Authenticated by a shared secret rather than a session: nothing here belongs
 * to a person, and a route that a browser can reach by cookie alone is one a
 * page on another site can make the browser reach.
 */

/** One drain at a time. A poll that is still connected when the next minute
 *  comes round would otherwise be joined by a second one collecting the same
 *  mail. A module-level flag holds for this server, which is what a
 *  single-process deployment needs and the whole of what it can promise. */
let draining = false;

export async function POST(request: Request) {
  const expected = process.env.MAIL_POLL_TOKEN;
  // An instance that never set a token has not opted in to being polled, and a
  // route whose secret is the empty string is not guarded at all.
  if (!expected) return refuse();

  const offered = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!matches(offered, expected)) return refuse();

  if (draining) {
    return NextResponse.json(
      { error: { code: "busy", message: "Already draining." } },
      { status: 409 },
    );
  }

  draining = true;
  const counts = { sent: 0, failed: 0, filed: 0, bounced: 0, skipped: 0, stale: 0 };
  const problems: string[] = [];
  const warnings: string[] = [];

  try {
    // Out before in, and each half on its own: a mailbox that is refusing
    // connections must not hide the fact that the outbox went out. Whoever is
    // reading this at two in the morning needs to know which half is broken.
    // Not mail, but the only thing in the app that runs on a clock is this
    // route: a page that goes stale with nobody told is the whole of what the
    // review date was for.
    const drains: Array<() => Promise<Partial<typeof counts> & { problems?: string[] }>> = [
      drainOutbox,
      drainInbox,
      sweepStaleDocs,
    ];

    for (const drain of drains) {
      try {
        // What a drain refused but carried on past — an oversized attachment,
        // say. Not a failure: the message was filed and only the part that
        // would not fit was left behind, so it reads beside the counts rather
        // than turning the whole poll into an error.
        const { problems: said = [], ...tally } = await drain();
        Object.assign(counts, tally);
        warnings.push(...said);
      } catch (error) {
        problems.push(reason(error));
      }
    }
  } finally {
    draining = false;
  }

  // Counts either way, so a `curl -f` on a timer fails loudly while the answer
  // still says what did get through.
  return NextResponse.json(
    {
      data: counts,
      ...(warnings.length ? { warnings } : {}),
      ...(problems.length ? { errors: problems } : {}),
    },
    { status: problems.length ? 502 : 200 },
  );
}

/** A cron entry that only knows how to GET is still a cron entry. */
export const GET = POST;

function refuse() {
  return NextResponse.json(
    { error: { code: "unauthenticated", message: "Wrong or missing token." } },
    { status: 401 },
  );
}

/** Compared in constant time, so the answer cannot be found a character at a
 *  time by watching how long the refusal takes. */
function matches(offered: string, expected: string) {
  const a = Buffer.from(offered);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
