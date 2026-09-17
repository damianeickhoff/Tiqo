import "server-only";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { readAttribute } from "@/lib/cmdb";
import { qrMatrix, qrPath } from "@/lib/qr";
import type { CiLabel } from "@/components/cmdb/ci-label-sheet";

/// A sheet, not a print run. Twenty labels is a page of A4 and a morning's
/// work; a request for five hundred is somebody who meant to filter first.
const MAX_LABELS = 40;

/**
 * Where this instance answers, as a label has to say it.
 *
 * The request's own host rather than a configured address: somebody printing
 * labels is standing in front of the instance they mean, and a code that opens
 * a staging server because that is what the environment file said is a code
 * nobody finds out is wrong until it is on a rack door.
 */
async function origin() {
  const header = await headers();
  const host = header.get("x-forwarded-host") ?? header.get("host") ?? "localhost";
  const protocol = header.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

/** The labels for a handful of assets, in the order they were asked for. */
export async function labelsFor(ids: string[]): Promise<CiLabel[]> {
  const wanted = [...new Set(ids)].slice(0, MAX_LABELS);
  if (wanted.length === 0) return [];

  const [base, items] = await Promise.all([
    origin(),
    prisma.configurationItem.findMany({
      where: { id: { in: wanted } },
      select: {
        id: true,
        name: true,
        attributes: true,
        type: {
          select: {
            name: true,
            fields: {
              where: { kind: "TEXT" },
              orderBy: { position: "asc" },
              take: 1,
              select: { key: true, label: true },
            },
          },
        },
      },
    }),
  ]);

  const byId = new Map(items.map((item) => [item.id, item]));

  return wanted.flatMap((id) => {
    const item = byId.get(id);
    if (!item) return [];

    const field = item.type.fields[0];
    const subtitle = field
      ? readAttribute(
          { ...field, kind: "TEXT", required: false, options: [], isExpiry: false },
          item.attributes,
        )
      : null;

    const url = `${base}/cmdb/${item.id}`;
    const matrix = qrMatrix(url);

    return [
      {
        id: item.id,
        name: item.name,
        typeName: item.type.name,
        subtitle: typeof subtitle === "string" && subtitle ? subtitle : null,
        url,
        path: matrix ? qrPath(matrix) : null,
        size: matrix?.size ?? 0,
      },
    ];
  });
}
