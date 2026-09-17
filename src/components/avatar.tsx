import { cn } from "@/lib/utils";

/**
 * Illustrated avatars rather than initials. Eight variants people pick from,
 * drawn from one figure with different colourways and hair — enough variety to
 * tell a roster apart without shipping eight separate illustrations.
 */
export const AVATARS = [
  { bg: "#f7a23b", skin: "#f2c9a0", hair: "#3b2a1d", shirt: "#4aa3c7", hairStyle: 0 },
  { bg: "#7bc4a4", skin: "#8d5a3b", hair: "#1d1512", shirt: "#e8e3d8", hairStyle: 1 },
  { bg: "#8ea8e8", skin: "#f5d9bd", hair: "#c96a2e", shirt: "#3d4a63", hairStyle: 2 },
  { bg: "#e88fa8", skin: "#c98d63", hair: "#2b1f19", shirt: "#f2ead9", hairStyle: 1 },
  { bg: "#c3a6e8", skin: "#f2c9a0", hair: "#8a8f99", shirt: "#5b4a7d", hairStyle: 0 },
  { bg: "#f2d06b", skin: "#6b4230", hair: "#241a14", shirt: "#2f7d63", hairStyle: 2 },
  { bg: "#6fb8d6", skin: "#f5d9bd", hair: "#5c3a1e", shirt: "#d9563f", hairStyle: 1 },
  { bg: "#a8c98a", skin: "#e0ab7e", hair: "#161210", shirt: "#3a3f52", hairStyle: 0 },
] as const;

export const AVATAR_COUNT = AVATARS.length;

/** Falls back to a name-derived variant so a person always has a stable face,
 *  even before they have picked one. */
function variantFor(name: string, chosen?: number | null) {
  if (typeof chosen === "number" && chosen >= 0 && chosen < AVATAR_COUNT) return chosen;

  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 997;
  return hash % AVATAR_COUNT;
}

export function Avatar({
  name,
  variant,
  size = 32,
  className,
}: {
  name: string;
  variant?: number | null;
  size?: number;
  className?: string;
}) {
  const face = AVATARS[variantFor(name, variant)]!;

  return (
    <span
      className={cn("inline-block shrink-0 overflow-hidden rounded-full", className)}
      style={{ width: size, height: size }}
      title={name}
      role="img"
      aria-label={name}
    >
      <AvatarArt face={face} />
    </span>
  );
}

/** The drawing itself, shared by the avatar and the picker. */
export function AvatarArt({ face }: { face: (typeof AVATARS)[number] }) {
  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden>
      <circle cx="32" cy="32" r="32" fill={face.bg} />

      {/* Shoulders, clipped by the circle so the figure sits in the frame. */}
      <clipPath id={`clip-${face.bg.slice(1)}-${face.hairStyle}`}>
        <circle cx="32" cy="32" r="32" />
      </clipPath>
      <g clipPath={`url(#clip-${face.bg.slice(1)}-${face.hairStyle})`}>
        <path d="M12 64c0-11 9-17 20-17s20 6 20 17z" fill={face.shirt} />
        <rect x="27" y="36" width="10" height="9" rx="4" fill={face.skin} />
        <circle cx="32" cy="27" r="13" fill={face.skin} />

        {face.hairStyle === 0 ? (
          <path d="M19 27a13 13 0 0 1 26 0c0-6-4-9-13-9s-13 3-13 9z" fill={face.hair} />
        ) : null}
        {face.hairStyle === 1 ? (
          <path
            d="M19 28c0-9 6-14 13-14s13 5 13 14c0-4-3-6-6-6-4 0-4 2-7 2s-3-2-7-2c-3 0-6 2-6 6z"
            fill={face.hair}
          />
        ) : null}
        {face.hairStyle === 2 ? (
          <path
            d="M18 30c-1-11 6-16 14-16s15 5 14 16c-1-3-2-7-6-8-3 3-13 4-17 1-3 1-4 4-5 7z"
            fill={face.hair}
          />
        ) : null}

        <circle cx="27" cy="28" r="1.6" fill="#2b2118" />
        <circle cx="37" cy="28" r="1.6" fill="#2b2118" />
        <path
          d="M28.5 33.5a5 5 0 0 0 7 0"
          stroke="#2b2118"
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
        />
      </g>
    </svg>
  );
}
