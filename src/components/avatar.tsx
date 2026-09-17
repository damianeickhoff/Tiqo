import { cn } from "@/lib/utils";

/**
 * A person, at whatever size the page has room for.
 *
 * A picture they uploaded if they have one. Otherwise the instance says what
 * everybody without one looks like: a plain silhouette, or their initials on a
 * colour. The illustrated faces this used to draw — eight cartoon figures with
 * hair and shirts — were more detail than a 24px circle can carry and more
 * personality than a colleague's name deserves.
 */
export type AvatarFallback = "SILHOUETTE" | "INITIALS";

/**
 * The colours initials sit on. One per variant, so the number every caller
 * already passes still tells a roster apart — it just picks a background now
 * rather than a face.
 */
const TINTS = [
  "#c2703a",
  "#2f7d63",
  "#4a63a8",
  "#a8456b",
  "#6b4aa8",
  "#8a6a1f",
  "#2f6f8a",
  "#4f6b3a",
] as const;

export const AVATAR_COUNT = TINTS.length;

/** A stable colour even before anybody has chosen one. */
function tintFor(name: string, chosen?: number | null) {
  if (typeof chosen === "number" && chosen >= 0 && chosen < AVATAR_COUNT) return TINTS[chosen]!;

  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 997;
  return TINTS[hash % AVATAR_COUNT]!;
}

/**
 * First letter of the first name, first letter of the last — the two letters
 * somebody would write on a locker. Falls back to one letter for a mononym and
 * to nothing at all for a name made only of punctuation, where the silhouette
 * is the better answer than an empty circle.
 */
export function initialsOf(name: string) {
  const parts = name
    .split(/\s+/)
    .map((part) => part.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0]![0]!;
  const last = parts.length > 1 ? parts[parts.length - 1]![0]! : "";
  return (first + last).toUpperCase();
}

export function Avatar({
  name,
  variant,
  image,
  fallback = "INITIALS",
  size = 32,
  className,
}: {
  name: string;
  /// Which colour their initials sit on. Kept from the illustrated faces.
  variant?: number | null;
  /// The picture they uploaded, where the caller has it to hand.
  image?: string | null;
  fallback?: AvatarFallback;
  size?: number;
  className?: string;
}) {
  const initials = fallback === "INITIALS" ? initialsOf(name) : "";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: image
          ? "var(--surface-2)"
          : initials
            ? tintFor(name, variant)
            : "var(--surface-3)",
      }}
      title={name}
      role="img"
      aria-label={name}
    >
      {image ? (
        // Not next/image: these are small, they come from our own route, and a
        // loader in front of a 40px circle is machinery for nothing.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="size-full object-cover" />
      ) : initials ? (
        <span
          aria-hidden
          className="font-semibold text-white"
          // Scaled to the circle rather than stepped: the same component draws
          // a 22px row avatar and a 72px one on a profile.
          style={{ fontSize: Math.round(size * 0.4), letterSpacing: "0.01em" }}
        >
          {initials}
        </span>
      ) : (
        <Silhouette />
      )}
    </span>
  );
}

/** The plain figure, for a desk that would rather not guess at initials. */
function Silhouette() {
  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden>
      <circle cx="32" cy="24" r="12" fill="var(--text-3)" />
      <path d="M8 64c0-13 11-21 24-21s24 8 24 21z" fill="var(--text-3)" />
    </svg>
  );
}
