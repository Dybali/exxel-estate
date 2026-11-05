import { AirVent, Armchair, Building2, Bug, Calculator, CalendarDays, Camera, Cctv, ClipboardCheck, DoorOpen, FileCheck, Globe, Hammer, IdCard, KeyRound, Landmark, Languages, LayoutGrid, PaintRoller, Palette, Plug, Scale, ShieldCheck, Sofa, Sparkles, Trees, Truck, Umbrella, Warehouse, Waves, Wrench, Zap, type LucideIcon } from "lucide-react";

// Icons named in lib/service-categories.ts (tests/services.test.mjs checks every name is mapped).
export const SERVICE_ICONS: Record<string, LucideIcon> = { AirVent, Armchair, Building2, Bug, Calculator, CalendarDays, Camera, Cctv, ClipboardCheck, DoorOpen, FileCheck, Globe, Hammer, IdCard, KeyRound, Landmark, Languages, LayoutGrid, PaintRoller, Palette, Plug, Scale, ShieldCheck, Sofa, Sparkles, Trees, Truck, Umbrella, Warehouse, Waves, Wrench, Zap };

export function ServiceIcon({ name, size = 22 }: { name: string; size?: number }) {
  const Icon = SERVICE_ICONS[name] || Wrench;
  return <Icon size={size} aria-hidden="true"/>;
}
