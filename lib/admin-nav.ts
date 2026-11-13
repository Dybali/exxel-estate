// Yönetim menu (owner's request 2026-11-13: 18 separate menu links were too many). Six groups; each group's
// screens are tabs at the top of the page. The ?view= ids are unchanged, so every old link still opens its screen.
export type AdminView = { id: string; label: string; href?: string };
export type AdminGroup = { id: string; label: string; icon: string; views: AdminView[] };

export const ADMIN_GROUPS: AdminGroup[] = [
  { id: "overview", label: "Genel bakış", icon: "overview", views: [{ id: "overview", label: "Genel bakış" }] },
  { id: "listings", label: "İlanlar", icon: "listings", views: [
    { id: "listings", label: "Tüm ilanlar" }, { id: "suspicious", label: "Şüpheli ilanlar" }, { id: "projects", label: "Projeler" },
  ] },
  { id: "members", label: "Üyeler ve firmalar", icon: "members", views: [
    { id: "applications", label: "Emlakçı başvuruları" }, { id: "services", label: "Hizmet firmaları" }, { id: "contractors", label: "Müteahhitler" },
  ] },
  { id: "inbox", label: "İletişim", icon: "inbox", views: [
    { id: "messages", label: "Mesajlar" }, { id: "contact", label: "İletişim mesajları" }, { id: "reports", label: "Bildirimler" }, { id: "feedback", label: "Öneriler" },
  ] },
  { id: "orders", label: "Siparişler", icon: "orders", views: [{ id: "orders", label: "Siparişler" }] },
  { id: "system", label: "Sistem", icon: "system", views: [
    { id: "health", label: "Sistem durumu" }, { id: "ai-limits", label: "Yapay zekâ kotaları" }, { id: "translation-trial", label: "Çeviri testi" },
    { id: "settings", label: "Ayarlar" }, { id: "audit", label: "İşlem geçmişi" }, { id: "security", label: "Güvenlik ayarları", href: "/yonetim/guvenlik" },
  ] },
];

export const adminHref = (view: AdminView) => view.href || "/yonetim?view=" + view.id;
/** The group a screen belongs to; unknown screens fall back to the overview. */
export const adminGroup = (view: string) => ADMIN_GROUPS.find((group) => group.views.some((item) => item.id === view)) || ADMIN_GROUPS[0];
export const adminViewLabel = (view: string) => ADMIN_GROUPS.flatMap((group) => group.views).find((item) => item.id === view)?.label;
