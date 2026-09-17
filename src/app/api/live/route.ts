import { getCurrentUser } from "@/lib/auth";
import { subscribe } from "@/lib/live";

/** Held open for as long as the tab is, so it must never be cached or
 *  pre-rendered. */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** A comment line every half minute. Proxies close a stream that has gone quiet,
 *  and the client would then reconnect on a timer it did not need to. */
const HEARTBEAT_MS = 30_000;

/**
 * The live stream a browser keeps open.
 *
 * Server-sent events rather than a socket: this only ever travels one way, it
 * survives proxies that know nothing but HTTP, and the browser reconnects on
 * its own when a laptop lid closes and opens again.
 *
 * The events carry no content — only "something happened for you". The bell
 * then asks for the rows through the same action it always used, so nothing
 * about who may read what has to be decided twice.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let open = true;

      const send = (event: string) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`data: ${event}\n\n`));
        } catch {
          open = false;
        }
      };

      const unsubscribe = await subscribe(user.id, send);

      // Says "connected" to the client and flushes any proxy buffering, which
      // is what otherwise makes the first real event arrive minutes late.
      send("open");

      const beat = setInterval(() => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(": beat\n\n"));
        } catch {
          open = false;
        }
      }, HEARTBEAT_MS);

      const close = () => {
        if (!open) return;
        open = false;
        clearInterval(beat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already gone with the request.
        }
      };

      request.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // Nginx buffers a response body by default, which for a stream means
      // holding every event until it decides it has enough of them.
      "x-accel-buffering": "no",
    },
  });
}
