/**
 * Shared by a server layout and a client component, so it deliberately lives in
 * neither: every export of a "use client" module becomes a client reference, and
 * a server component importing this name from there would receive a proxy
 * instead of the string.
 */
export const SIDEBAR_COOKIE = "tiqo_sidebar_collapsed";

export const THEME_COOKIE = "tiqo_theme";

/**
 * Column widths somebody has dragged, remembered for them alone.
 *
 * In the browser rather than on the account: what a column is worth differs per
 * desk and per screen, and the reader who widened one on their laptop is not
 * asking for it to be narrower on the wall display. Namespaced by table `key`,
 * so the queue, the asset register and the template list each keep their own.
 *
 * Anything unreadable comes back as nothing and the table uses its defaults — a
 * browser with storage switched off still gets a table.
 */
const COLUMNS_PREFIX = "tiqo.columns.";

export function readColumnWidths(key: string): Record<string, unknown> | null {
  try {
    const raw = window.localStorage.getItem(COLUMNS_PREFIX + key);
    if (!raw) return null;
    const found: unknown = JSON.parse(raw);
    return found && typeof found === "object" ? (found as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function writeColumnWidths(key: string, widths: Record<string, number>) {
  try {
    window.localStorage.setItem(COLUMNS_PREFIX + key, JSON.stringify(widths));
  } catch {
    // Not being able to remember it is no reason not to do it.
  }
}

/** Forgotten rather than set back to the defaults: a table with nothing stored
 *  follows whatever the defaults become, which is what "reset" should mean. */
export function clearColumnWidths(key: string) {
  try {
    window.localStorage.removeItem(COLUMNS_PREFIX + key);
  } catch {
    // As above.
  }
}

/** What someone can ask for. "system" is the default and means "whatever the
 *  machine is set to", which is also what it follows when nobody has chosen. */
export type ThemeChoice = "system" | "light" | "dark";

export const THEME_CHOICES: ThemeChoice[] = ["system", "light", "dark"];

export function readThemeChoice(value: string | undefined): ThemeChoice {
  return value === "light" || value === "dark" ? value : "system";
}

/**
 * The script that resolves "system" before the first paint.
 *
 * It runs in `<head>`, ahead of any rendering, so a dark-mode machine never
 * sees a white page flash first. An explicit choice is already on the element
 * from the server; this only fills in the case where there is nothing to go on
 * but the machine's own setting, and keeps following it if that changes while
 * the tab is open.
 */
export const THEME_SCRIPT = `(function(){try{
var el=document.documentElement;
var m=window.matchMedia('(prefers-color-scheme: dark)');
function apply(){if(el.dataset.themeChoice==='system'){el.dataset.theme=m.matches?'dark':'light';}}
apply();
m.addEventListener('change',apply);
}catch(e){}})();`;
