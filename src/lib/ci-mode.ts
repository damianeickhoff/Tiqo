/**
 * Shared by the register's server page and the toggle in its head, so it lives
 * in neither: every export of a `"use client"` module becomes a client
 * reference, and a server component reading this name from there would receive
 * a proxy instead of the string. The same reason `ui-preferences.ts` exists.
 */
export const CI_MODE_COOKIE = "tiqo_ci_mode";

/** Whether the register is a table or a table beside a pane. Split by default:
 *  the pane is the thing that makes browsing a register cheap, and a preference
 *  nobody has expressed should be the better one. */
export type CiMode = "list" | "split";

export function readCiMode(value: string | undefined): CiMode {
  return value === "list" ? "list" : "split";
}
