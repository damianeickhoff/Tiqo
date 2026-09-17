import {
  Boxes,
  HardDrive,
  KeyRound,
  Laptop,
  Network,
  Printer,
  Server,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

/**
 * A type's mark.
 *
 * The icon is stored as a name rather than an upload, so a type costs nothing to
 * add — the same trade `PortalCategory` already makes. The names a type may use
 * are listed here rather than looked up dynamically: pulling an icon by string
 * out of the whole library drags all of it into the bundle to draw one glyph.
 */
const ICONS = {
  HardDrive,
  Laptop,
  Server,
  Network,
  Printer,
  Smartphone,
  ShieldCheck,
  KeyRound,
  Boxes,
} as const;

export type CiIconName = keyof typeof ICONS;

export const CI_ICON_NAMES = Object.keys(ICONS) as CiIconName[];

export function CiGlyph({
  icon,
  color,
  size = 15,
}: {
  icon: string | null;
  color: string;
  size?: number;
}) {
  const Icon = (icon && icon in ICONS ? ICONS[icon as CiIconName] : Boxes) ?? Boxes;

  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-[7px]"
      style={{
        width: size + 13,
        height: size + 13,
        background: `color-mix(in oklab, ${color} 16%, transparent)`,
        color: `color-mix(in oklab, ${color} 72%, var(--text))`,
      }}
    >
      <Icon size={size} strokeWidth={2} />
    </span>
  );
}
