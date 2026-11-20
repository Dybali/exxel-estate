import { AdminPreRegistrations } from "@/components/AdminPreRegistrations";
import { adminPageUser } from "@/lib/admin-page";
export const dynamic = "force-dynamic";
export const metadata = { title: "Ön kayıtlar | estatemarket24", robots: { index: false, follow: false } };
export default async function PreRegistrationsPage() { await adminPageUser("/yonetim/on-kayitlar"); return <AdminPreRegistrations/>; }
