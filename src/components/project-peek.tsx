"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { peekProject, type ProjectPeek } from "@/lib/actions/peek";
import { HEALTH_META, progressOf } from "@/lib/projects";
import { Modal } from "@/components/modal";
import { Avatar } from "@/components/avatar";
import { buttonClass } from "@/components/ui";
import { useMessages } from "@/components/shell/instance-context";

/**
 * A project, without leaving whatever named it.
 *
 * The same bargain the ticket version makes: enough to know what you are
 * looking at, and a way through to the real thing for anything that needs
 * doing.
 */
export function ProjectPeekDialog({
  projectKey,
  onClose,
}: {
  projectKey: string;
  onClose: () => void;
}) {
  const t = useMessages();
  const [project, setProject] = useState<ProjectPeek | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let live = true;
    peekProject(projectKey).then((row) => {
      if (!live) return;
      setProject(row);
      setMissing(row === null);
    });
    return () => {
      live = false;
    };
  }, [projectKey]);

  const progress = project ? progressOf(project.settled, project.total) : null;

  return (
    <Modal
      title={project?.name ?? projectKey}
      description={project ? project.key : undefined}
      onClose={onClose}
    >
      {missing ? (
        <p className="text-text-3 py-8 text-center text-base">{t.common.noMatches}</p>
      ) : !project || !progress ? (
        <p className="text-text-3 py-8 text-center text-base">{t.common.saving}</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2.5 py-1 text-sm font-medium"
              style={{
                background: HEALTH_META[project.health].tint,
                color: HEALTH_META[project.health].color,
              }}
            >
              {t.projects.healthNames[project.health]}
            </span>

            {project.lead ? (
              <span className="text-text-2 ml-auto inline-flex items-center gap-1.5 text-base">
                <Avatar name={project.lead.name} variant={project.lead.avatarVariant} size={20} />
                {project.lead.name}
              </span>
            ) : null}
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-3">
              <p className="label">{t.projects.progress}</p>
              <p className="text-text-2 text-base">
                {t.projects.settledOf(progress.settled, progress.total)}
              </p>
            </div>
            <div className="bg-surface-3 mt-2 h-2 overflow-hidden rounded-full">
              <div className="bg-brand h-full rounded-full" style={{ width: `${progress.pct}%` }} />
            </div>
          </div>

          <div className="border-border-soft flex justify-end border-t pt-4">
            <Link
              href={`/projects/${project.key}`}
              className={buttonClass("primary", "md")}
              onClick={onClose}
            >
              {t.projects.openPeeked}
              <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>
      )}
    </Modal>
  );
}
