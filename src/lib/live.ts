import "server-only";

import { Client } from "pg";

/**
 * Live delivery, without asking.
 *
 * A notification is written by whichever request happened to cause it, and has
 * to reach a browser that is sitting still on some other page. Polling was the
 * blunt version of that: every open tab asking every few seconds whether
 * anything had happened, which is a lot of questions to answer "no" to.
 *
 * Postgres already has the mechanism. The write says `pg_notify`, one listening
 * connection hears it, and the streams for that person are woken. Nothing asks;
 * the database tells. It also means two Tiqo processes behind a load balancer
 * both hear the same event, which an in-process event emitter would not manage.
 */

/** One channel for the whole instance; the payload says who it is for. */
const CHANNEL = "tiqo_live";

type Listener = (event: string) => void;

/** Open streams, by the person they belong to. */
const listeners = new Map<string, Set<Listener>>();

let client: Client | null = null;
let connecting: Promise<void> | null = null;

/**
 * One long-lived connection for the whole process, opened on the first
 * subscriber and kept. It is deliberately not a pooled one: a pool would hand
 * the connection back between queries and the LISTEN with it.
 */
async function ensureListening() {
  if (client) return;
  if (connecting) return connecting;

  connecting = (async () => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set.");

    const next = new Client({ connectionString });
    next.on("notification", (message) => {
      if (message.channel !== CHANNEL || !message.payload) return;
      const [userId, event] = splitPayload(message.payload);
      for (const listener of listeners.get(userId) ?? []) listener(event);
    });

    // A dropped connection must not leave every open tab silently deaf: drop
    // the handle so the next subscriber opens a fresh one.
    next.on("error", () => {
      client = null;
      connecting = null;
    });

    await next.connect();
    await next.query(`LISTEN ${CHANNEL}`);
    client = next;
  })();

  try {
    await connecting;
  } finally {
    connecting = null;
  }
}

function splitPayload(payload: string): [userId: string, event: string] {
  const at = payload.indexOf(":");
  return at < 0 ? [payload, "ping"] : [payload.slice(0, at), payload.slice(at + 1)];
}

/**
 * Wake this person's open streams.
 *
 * Sent through the same pool every other query uses, so it takes part in the
 * transaction it is called from — a notification that never committed is never
 * announced. Failure is swallowed: a browser that misses the nudge finds out on
 * its next navigation, which is not worth failing a write over.
 */
export async function publish(
  db: { $executeRawUnsafe: (query: string, ...values: unknown[]) => Promise<number> },
  userId: string,
  event: string,
) {
  try {
    await db.$executeRawUnsafe(`SELECT pg_notify($1, $2)`, CHANNEL, `${userId}:${event}`);
  } catch {
    // Nothing here is worth taking a write down for.
  }
}

/** Listen for one person. Returns the way to stop. */
export async function subscribe(userId: string, listener: Listener) {
  await ensureListening();

  const set = listeners.get(userId) ?? new Set<Listener>();
  set.add(listener);
  listeners.set(userId, set);

  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(userId);
  };
}
