import { AdminTwoFactor } from "@/components/AdminTwoFactor";
import { adminPageUser } from "@/lib/admin-page";
export const dynamic = "force-dynamic";
export const metadata = { title: "Yönetici güvenliği | estatemarket24", robots: { index: false, follow: false } };
export default async function AdminSecurityPage() { await adminPageUser("/yonetim/guvenlik"); return <AdminTwoFactor/>; }
