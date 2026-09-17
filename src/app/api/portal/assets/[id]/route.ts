import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { readUpload, uploadSize } from "@/lib/files";

export const runtime = "nodejs";

/** Every refusal is a 404, as it is for attachments: a 403 confirms the id. */
const gone = () => new Response("Not found", { status: 404 });

/**
 * Hands back a picture the portal wears.
 *
 * Unlike an attachment there is nothing to weigh up about who may see it —
 * it is the background of a page every requester is shown — so the only test
 * is that somebody is signed in, which the portal already requires. It is not
 * served from `public/` because these arrive at runtime, and because a
 * directory the whole internet can list is a different promise.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) return gone();

  const asset = await prisma.portalAsset.findUnique({
    where: { id },
    select: { id: true, mimeType: true },
  });
  if (!asset) return gone();

  const size = await uploadSize(asset.id);
  if (size === null) return gone();

  return new Response(readUpload(asset.id), {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": String(size),
      // The type was decided when it was stored, against an allowlist of raster
      // formats, so the browser must not reconsider it here.
      "X-Content-Type-Options": "nosniff",
      // Unlike an attachment this may be cached: it is the same picture for
      // everybody, it changes only when an admin replaces it, and it is
      // fetched on every page of the portal. Private, because the portal is
      // behind a sign-in and a shared cache has no business holding it.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
