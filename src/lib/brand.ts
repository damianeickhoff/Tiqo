/**
 * Every brand token in the app derived from one hex.
 *
 * The stylesheet ships a full set of `--brand-*` values for the default amber;
 * these override them when the instance has been given a colour of its own. The
 * maths is deliberately plain sRGB — mixing toward black and white, and one
 * luminance test — rather than a colour library: the inputs are a handful of
 * tints and one contrast decision, and a dependency would earn nothing.
 */
type Rgb = { r: number; g: number; b: number };

export function parseHex(hex: string): Rgb | null {
  const value = hex.trim().replace(/^#/, "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;

  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;

  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

function toHex({ r, g, b }: Rgb) {
  const part = (n: number) =>
    Math.round(Math.min(255, Math.max(0, n)))
      .toString(16)
      .padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

/** `amount` of 0 keeps the colour, 1 lands entirely on the target. */
function mix(color: Rgb, target: Rgb, amount: number): Rgb {
  return {
    r: color.r + (target.r - color.r) * amount,
    g: color.g + (target.g - color.g) * amount,
    b: color.b + (target.b - color.b) * amount,
  };
}

const BLACK: Rgb = { r: 0, g: 0, b: 0 };
const WHITE: Rgb = { r: 255, g: 255, b: 255 };

/** Relative luminance, WCAG's definition — the one contrast decision here. */
function luminance({ r, g, b }: Rgb) {
  const channel = (value: number) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function rgba({ r, g, b }: Rgb, alpha: number) {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
}

export type BrandTokens = { light: Record<string, string>; dark: Record<string, string> };

/**
 * The same colour reads differently on the two surfaces, so each theme gets its
 * own set: on white the brand is darkened for text and lightened for washes; on
 * near-black it is lightened for text and the washes are barely there.
 */
export function brandTokens(hex: string): BrandTokens | null {
  const brand = parseHex(hex);
  if (!brand) return null;

  // Text sitting on a brand fill: black unless the fill is dark enough to need
  // white. The threshold is where the two contrast ratios cross.
  const ink = luminance(brand) > 0.45 ? mix(brand, BLACK, 0.86) : WHITE;

  return {
    light: {
      "--brand": toHex(brand),
      "--brand-hover": toHex(mix(brand, BLACK, 0.12)),
      "--brand-ink": toHex(ink),
      // Brand used as text on a light surface has to be dark enough to read.
      "--brand-deep": toHex(mix(brand, BLACK, 0.42)),
      "--brand-tint": rgba(brand, 0.16),
      "--brand-glow": rgba(brand, 0.32),
      "--brand-wash": toHex(mix(brand, WHITE, 0.95)),
      // The chrome is neutral now — a tinted rail was the old design — but the
      // keys stay so the settings preview keeps its swatch.
      "--chrome": "#fafafa",
      "--chrome-border": "rgba(9, 9, 11, 0.08)",
    },
    dark: {
      "--brand": toHex(brand),
      "--brand-hover": toHex(mix(brand, WHITE, 0.18)),
      "--brand-ink": toHex(ink),
      "--brand-deep": toHex(mix(brand, WHITE, 0.12)),
      "--brand-tint": rgba(brand, 0.14),
      "--brand-glow": rgba(brand, 0.26),
      "--brand-wash": toHex(mix(brand, BLACK, 0.92)),
      "--chrome": "#0c0c0e",
      "--chrome-border": "rgba(255, 255, 255, 0.08)",
    },
  };
}

/**
 * The tokens as a stylesheet, light plus the dark override.
 *
 * Keyed on the same `data-theme` attribute as every other token rather than on
 * `prefers-color-scheme` — these have to move when someone chooses a theme, not
 * when their machine does. They did not, once, and a warning banner stayed dark
 * on a page that had gone light.
 */
export function brandStyleSheet(hex: string) {
  const tokens = brandTokens(hex);
  if (!tokens) return "";

  const declarations = (set: Record<string, string>) =>
    Object.entries(set)
      .map(([name, value]) => `${name}:${value};`)
      .join("");

  return (
    `:root{${declarations(tokens.light)}}` +
    `:root[data-theme="dark"]{${declarations(tokens.dark)}}`
  );
}
