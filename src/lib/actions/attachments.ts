"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canDeleteComment, canEditDocs, canViewTicket } from "@/lib/permissions";
import { getMessages } from "@/lib/settings";
import { removeUpload } from "@/lib/files";
import { refreshTicket } from "@/lib/refresh";
import { docHref } from "@/lib/docs";

/**
 * Removing one file.
 *
 * The same rule as a comment: you own what you attached, and moderating someone
 * else's is `comment.moderate` — a file on a conversation is part of the record
 * in exactly the way the words around it are. Unlike a comment it leaves a mark
 * in the trail whatever happens, because a file that disappears from a ticket
 * with nothing to show for it is the one thing worse than a file nobody can
 * delete.
 */
export async function deleteAttachment(attachmentId: string) {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);

  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    select: {
      id: true,
      filename: true,
      uploadedById: true,
      uploadedBy: { select: { name: true } },
      ticket: { select: { id: true, number: true, reporterId: true, assigneeId: true } },
      doc: { select: { slug: true, space: { select: { key: true } } } },
      comment: { select: { stepId: true } },
    },
  });
  if (!attachment) return { ok: false as const, error: t.errors.fileAlreadyGone };

  // A file on a document is part of the page, so whoever may rewrite the page
  // may take it off. No trail row: a document's history is its revisions, and
  // the only thing kept on its activity is the other end of a reference.
  if (attachment.doc) {
    if (!canEditDocs(user)) return { ok: false as const, error: t.errors.noDocEdit };

    await prisma.attachment.delete({ where: { id: attachmentId } });
    await removeUpload(attachmentId);

    revalidatePath(docHref(attachment.doc.space.key, attachment.doc.slug));
    return { ok: true as const };
  }

  const ticket = attachment.ticket;
  if (!ticket) return { ok: false as const, error: t.errors.fileAlreadyGone };

  // `canDeleteComment` asks exactly the question that needs asking here — is
  // this yours, or do you moderate — so it is asked rather than restated.
  if (
    !canViewTicket(user, ticket) ||
    !canDeleteComment(user, { authorId: attachment.uploadedById ?? "" })
  ) {
    return { ok: false as const, error: t.errors.ownFilesDelete };
  }

  await prisma.$transaction([
    prisma.attachment.delete({ where: { id: attachmentId } }),
    prisma.activity.create({
      data: {
        ticketId: ticket.id,
        actorId: user.id,
        type: "ATTACHMENT_REMOVED",
        field: "attachment",
        stepId: attachment.comment?.stepId ?? null,
        oldValue: attachment.filename,
        // Who to ask for it again. Left out when they are the one deleting it:
        // "Ada removed the file, uploaded by Ada" tells nobody anything.
        newValue:
          attachment.uploadedById && attachment.uploadedById !== user.id
            ? (attachment.uploadedBy?.name ?? null)
            : null,
      },
    }),
  ]);

  await removeUpload(attachmentId);

  refreshTicket(ticket.number);
  return { ok: true as const };
}
