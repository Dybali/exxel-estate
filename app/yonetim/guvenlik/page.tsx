import { AdminTwoFactor } from "@/components/AdminTwoFactor";
import { AdminGroupTabs } from "@/components/AdminGroupTabs";
import { adminPageUser } from "@/lib/admin-page";
export const dynamic = "force-dynamic";
export const metadata = { title: "Yönetici güvenliği | estatemarket24", robots: { index: false, follow: false } };
export default async function AdminSecurityPage() { await adminPageUser("/yonetim/guvenlik"); return <><div className="admin-main admin-main-tabs"><AdminGroupTabs view="security"/></div><AdminTwoFactor/></>; }
