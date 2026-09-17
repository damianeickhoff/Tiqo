"use client";

import { useTransition } from "react";
import { Archive, ArchiveRestore } from "lucide-react";
import { setProjectArchived } from "@/lib/actions/admin";
import { Button } from "@/components/ui";
import { useMessages } from "@/components/shell/instance-context";

/**
 * Archiving, beside deleting.
 *
 * The two belong together: they are the same question — "stop this being one of
 * the projects we are working on" — asked with different force, and putting
 * them side by side is what makes archiving the obvious first answer.
 */
export function ProjectArchiveToggle({
  projectId,
  isArchived,
}: {
  projectId: string;
  isArchived: boolean;
}) {
  const t = useMessages();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() => startTransition(() => void setProjectArchived(projectId, !isArchived))}
    >
      {isArchived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
      {isArchived ? t.projects.restore : t.projects.archive}
    </Button>
  );
}
