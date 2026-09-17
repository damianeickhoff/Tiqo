import {
  CircleHelp,
  Headphones,
  Key,
  Laptop,
  LifeBuoy,
  Mail,
  Monitor,
  Package,
  Phone,
  Printer,
  Settings,
  Shield,
  UserPlus,
  Wifi,
  Wrench,
} from "lucide-react";

/**
 * A small, fixed set of icons a portal actually needs, chosen by name in
 * settings. A name rather than an upload: a section costs nothing to add, and
 * nobody has to find a picture before they can publish a form.
 */
export const PORTAL_ICONS = {
  help: CircleHelp,
  laptop: Laptop,
  monitor: Monitor,
  printer: Printer,
  wifi: Wifi,
  key: Key,
  mail: Mail,
  phone: Phone,
  headphones: Headphones,
  package: Package,
  wrench: Wrench,
  shield: Shield,
  settings: Settings,
  person: UserPlus,
  support: LifeBuoy,
} as const;

export type PortalIconName = keyof typeof PORTAL_ICONS;

export function PortalIcon({ name, size = 18 }: { name: string | null; size?: number }) {
  const Icon = (name && PORTAL_ICONS[name as PortalIconName]) || CircleHelp;
  return <Icon size={size} />;
}
