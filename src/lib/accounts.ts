import "server-only";

import { prisma } from "@/lib/prisma";

/** First + last, which is what every list, avatar and mention reads. */
export function displayName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
}

/**
 * A handle nobody else holds, derived from the email address. The counter is
 * appended rather than random so the second "sam" is `sam2`, which is the shape
 * people expect — and the loop terminates because each miss raises it.
 */
export async function uniqueUsername(email: string) {
  const base =
    email
      .split("@")[0]!
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "") || "user";

  for (let suffix = 0; ; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}${suffix + 1}`;
    const taken = await prisma.user.findUnique({
      where: { username: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
}
