// Hesabım panel per account type (owner's request 2026-11-13: one template for individuals, one for agents, and the
// contractor and service-firm accounts each get their own). The firm panels keep their own sub-tabs (profile,
// requests, documents…). Pure: components/Dashboard.tsx renders the tabs.
import type { AccountKind } from "./account-kind";

export type PanelTabId = "genel" | "favoriler" | "aramalar" | "ilanlarim" | "projelerim" | "mesajlar" | "randevular" | "crm" | "talep-akisi" | "talepler" | "siparisler" | "teklifler" | "firma" | "ekip" | "muteahhit" | "hizmet" | "profil";
export type PanelTab = { id: PanelTabId; label: string };

/** Tabs of each account type, in menu order. `hasListings`: an individual who posts listings also gets leads and orders. */
// "Talep akışı" (components/LeadBoard.tsx): the open board of Benim için bul requests, its own tab right after the
// overview for agents; admins see it too (read-only) whatever their account type.
export function panelTabs(kind: AccountKind, options: { hasListings?: boolean; developer?: boolean; admin?: boolean } = {}): PanelTab[] {
  const tabs = tabsOf(kind, options);
  if (options.admin && !tabs.some((item) => item.id === "talep-akisi")) tabs.splice(1, 0, { id: "talep-akisi", label: "Talep akışı" });
  return tabs;
}
function tabsOf(kind: AccountKind, options: { hasListings?: boolean; developer?: boolean }): PanelTab[] {
  const tab = (id: PanelTabId, label: string) => ({ id, label });
  switch (kind) {
    case "agent": return [
      tab("genel", "Genel Bakış"), tab("talep-akisi", "Talep akışı"), tab("ilanlarim", "İlanlarım"), tab("projelerim", "Projelerim"), tab("mesajlar", "Mesajlar"),
      tab("crm", "CRM"), tab("firma", options.developer ? "Firma bilgilerim" : "Ofis bilgilerim"),
      tab("ekip", "Ekibim"), tab("siparisler", "Paketler ve siparişler"), tab("profil", "Profilim"),
    ];
    case "contractor": return [
      tab("genel", "Genel Bakış"), tab("muteahhit", "Firma panelim"), tab("mesajlar", "Mesajlar"), tab("profil", "Profilim"),
    ];
    case "service": return [
      tab("genel", "Genel Bakış"), tab("hizmet", "Firma panelim"), tab("mesajlar", "Mesajlar"), tab("profil", "Profilim"),
    ];
    default: return [
      tab("genel", "Genel Bakış"), tab("favoriler", "Favorilerim"), tab("aramalar", "Aramalarım ve bildirimler"), tab("ilanlarim", "İlanlarım"),
      tab("mesajlar", "Mesajlar"), tab("randevular", "Randevularım"),
      ...(options.hasListings ? [tab("crm", "İlan istatistikleri"), tab("siparisler", "Siparişlerim")] : []),
      // Consultants join an estate office here (invitation or office code, components/CompanyTeam.tsx).
      tab("teklifler", "Tekliflerim"), tab("ekip", "Ofis ekibi"), tab("profil", "Profilim"),
    ];
  }
}

// Old links (e-mails, other pages) still land on the right place.
const ALIASES: Record<string, PanelTabId> = { bildirimler: "aramalar", bildirimlerim: "aramalar", "kat-karsiligi": "teklifler", favorites: "favoriler", talepler: "crm", istatistik: "crm", "musteri-talepleri": "talep-akisi", "talep-akisi": "talep-akisi" };
/** The tab to show for a `?tab=` value: aliases resolved, unknown or foreign tabs fall back to the overview. */
export function panelTab(requested: string | null, tabs: PanelTab[]): PanelTabId {
  // No tab or "baslangic" (sign-up, e-mail verification): firm accounts start on their firm panel.
  if (!requested || requested === "baslangic") return tabs.find((tab) => tab.id === "muteahhit" || tab.id === "hizmet")?.id ?? "genel";
  const id = ALIASES[requested] ?? requested;
  if (tabs.some((tab) => tab.id === id)) return id as PanelTabId;
  // Agents find appointments inside CRM.
  if (id === "randevular" && tabs.some((tab) => tab.id === "crm")) return "crm";
  // "Firmanızı ekleyin" links from other account types land where the account type is changed.
  return id === "muteahhit" || id === "hizmet" ? "profil" : "genel";
}

export const ACCOUNT_KIND_LABELS: Record<AccountKind, string> = { individual: "Bireysel", agent: "Emlakçı", contractor: "Müteahhit", service: "Hizmet firması" };

/** What the account is, shown under the name in Hesabım (owner's request 2026-11-17): an office's consultant is
 *  "Danışman" (with the office's name), an estate agent is an "Emlak ofisi" or "İnşaat firması", a personal
 *  account that sells is "Bireysel (mal sahibi)". */
export function accountTypeLabel(account: { kind: AccountKind; role: string; companyCategory?: string | null; isAdmin?: boolean; office?: string | null }) {
  if (account.isAdmin) return "Yönetici";
  if (account.office && account.kind === "individual") return "Danışman";
  if (account.kind === "agent") return account.companyCategory === "developer" ? "İnşaat firması" : "Emlak ofisi";
  if (account.kind === "individual") return account.role === "individual" ? "Bireysel (mal sahibi)" : "Bireysel";
  return ACCOUNT_KIND_LABELS[account.kind];
}
