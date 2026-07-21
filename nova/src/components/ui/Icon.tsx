import {
  UserRound,
  Gem,
  MapPin,
  ShieldCheck,
  CarFront,
  Compass,
  Droplets,
  Sparkles,
  MessageCircle,
  Route,
  TreePalm,
  type LucideIcon,
} from "lucide-react";

/** Maps the string icon keys used in content.ts to lucide components. */
const ICONS: Record<string, LucideIcon> = {
  "user-round": UserRound,
  gem: Gem,
  "map-pin": MapPin,
  "shield-check": ShieldCheck,
  "car-front": CarFront,
  compass: Compass,
  droplets: Droplets,
  sparkles: Sparkles,
  "message-circle": MessageCircle,
  route: Route,
  palmtree: TreePalm,
};

export function Icon({
  name,
  className,
  strokeWidth = 1.5,
}: {
  name: string;
  className?: string;
  strokeWidth?: number;
}) {
  const Cmp = ICONS[name] ?? Sparkles;
  return <Cmp className={className} strokeWidth={strokeWidth} aria-hidden="true" />;
}
