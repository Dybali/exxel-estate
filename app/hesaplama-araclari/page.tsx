import "../tools.css";
import { PropertyCalculators } from "@/components/PropertyCalculators";
import { env } from "@/lib/runtime";
import { calculatorDefaults } from "@/lib/property-calculators";

export const dynamic = "force-dynamic";
// Rent increase, title deed fee and costs (lib/property-calculators.ts). Title and description: lib/seo-copy.ts.
export default function Page() { return <PropertyCalculators defaults={calculatorDefaults(env as Record<string, unknown>)}/>; }
