"use client";

import { useEffect } from "react";
import { setCrumb } from "@/lib/topbar-crumb";

/**
 * Announces the open ticket to the layout's top bar. The bar sits above the
 * page in the tree, so the value cannot be passed down as a prop — it goes
 * sideways through a store the bar subscribes to.
 *
 * Clearing on unmount is what keeps a stale reference off the bar when you
 * leave the ticket: React runs this cleanup before the next page's effects.
 */
export function TopBarBreadcrumb({ reference, title }: { reference: string; title: string }) {
  useEffect(() => {
    setCrumb({ reference, title });
    return () => setCrumb(null);
  }, [reference, title]);

  return null;
}
