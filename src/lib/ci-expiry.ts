import "server-only";

import { prisma } from "@/lib/prisma";
import { EXPIRY_DAYS, isoDay } from "@/lib/ci-views";

/**
 * What "expiring" means right now: which attribute keys run out, and the window.
 *
 * The keys are gathered across every type when nothing is being stood in,
 * because the question is about the estate rather than about laptops — a
 * certificate and a licence run out in different columns and somebody asking
 * "what needs doing this month" means both. Distinct, because two types calling
 * their date `expires` is one key to compare against, not two.
 */
export async function expiryWindow(typeKey?: string, now = new Date()) {
  const fields = await prisma.ciTypeField.findMany({
    where: {
      kind: "DATE",
      isExpiry: true,
      ...(typeKey ? { type: { is: { key: typeKey } } } : {}),
    },
    select: { key: true },
  });

  const horizon = new Date(now);
  horizon.setUTCDate(horizon.getUTCDate() + EXPIRY_DAYS);

  return {
    keys: [...new Set(fields.map((field) => field.key))],
    // From today rather than from the beginning of time: something that ran out
    // last year is not expiring, it has expired, and mixing the two makes the
    // view a list nobody can work through.
    from: isoDay(now),
    to: isoDay(horizon),
  };
}
