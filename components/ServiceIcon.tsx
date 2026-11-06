import { AirVent, AppWindow, Armchair, ArrowUpDown, Baby, Blinds, BrushCleaning, Bug, Building, Building2, Calculator, CalendarDays, Camera, Cctv, ChefHat, ClipboardCheck, DoorOpen, Drill, Droplets, FileCheck, Flame, Globe, Hammer, HeartHandshake, House, IdCard, KeyRound, Landmark, Languages, LayoutGrid, LockKeyhole, PaintRoller, Palette, PawPrint, Plug, SatelliteDish, Scale, ShieldCheck, ShieldUser, Shirt, Sofa, SolarPanel, Sparkles, Stethoscope, Sun, Toolbox, Trees, Truck, Umbrella, Warehouse, WashingMachine, Waves, Wrench, Zap, type LucideIcon } from "lucide-react";

// Icons named in lib/service-categories.ts (tests/services.test.mjs checks every name is mapped).
export const SERVICE_ICONS: Record<string, LucideIcon> = { AirVent, AppWindow, Armchair, ArrowUpDown, Baby, Blinds, BrushCleaning, Bug, Building, Building2, Calculator, CalendarDays, Camera, Cctv, ChefHat, ClipboardCheck, DoorOpen, Drill, Droplets, FileCheck, Flame, Globe, Hammer, HeartHandshake, House, IdCard, KeyRound, Landmark, Languages, LayoutGrid, LockKeyhole, PaintRoller, Palette, PawPrint, Plug, SatelliteDish, Scale, ShieldCheck, ShieldUser, Shirt, Sofa, SolarPanel, Sparkles, Stethoscope, Sun, Toolbox, Trees, Truck, Umbrella, Warehouse, WashingMachine, Waves, Wrench, Zap };

export function ServiceIcon({ name, size = 22 }: { name: string; size?: number }) {
  const Icon = SERVICE_ICONS[name] || Wrench;
  return <Icon size={size} aria-hidden="true"/>;
}
