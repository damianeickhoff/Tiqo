import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canViewDocs } from "@/lib/permissions";

/**
 * The documentation area, and the one gate in front of it.
 *
 * `notFound` rather than a redirect, for the same reason the settings area
 * does it: somebody who may not read the desk's runbooks has no business
 * learning that they exist.
 */
export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!canViewDocs(user)) notFound();

  return <>{children}</>;
}
