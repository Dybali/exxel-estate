// Hesabım panel per account type (owner's request 2026-11-13: one template for individuals, one for agents, and the
// contractor and service-firm accounts each get their own). The firm panels keep their own sub-tabs (profile,
// requests, documents…). Pure: components/Dashboard.tsx renders the tabs.
import type { AccountKind } from "./account-kind";

export type PanelTabId = "genel" | "favoriler" | "aramalar" | "ilanlarim" | "projelerim" | "mesajlar" | "randevular" | "talepler" | "siparisler" | "teklifler" | "firma" | "ekip" | "muteahhit" | "hizmet" | "profil";
export type PanelTab = { id: PanelTabId; label: string };

/** Tabs of each account type, in menu order. `hasListings`: an individual who posts listings also gets leads and orders. */
export function panelTabs(kind: AccountKind, options: { hasListings?: boolean; developer?: boolean } = {}): PanelTab[] {
  const tab = (id: PanelTabId, label: string) => ({ id, label });
  switch (kind) {
    case "agent": return [
      tab("genel", "Genel Bakış"), tab("ilanlarim", "İlanlarım"), tab("projelerim", "Projelerim"), tab("mesajlar", "Mesajlar"),
      tab("talepler", "Müşteri talepleri"), tab("randevular", "Randevularım"), tab("firma", options.developer ? "Firma bilgilerim" : "Ofis bilgilerim"),
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
      ...(options.hasListings ? [tab("talepler", "Müşteri talepleri"), tab("siparisler", "Siparişlerim")] : []),
      tab("teklifler", "Tekliflerim"), tab("profil", "Profilim"),
    ];
  }
}

// Old links (e-mails, other pages) still land on the right place.
const ALIASES: Record<string, PanelTabId> = { bildirimler: "aramalar", bildirimlerim: "aramalar", "kat-karsiligi": "teklifler", favorites: "favoriler" };
/** The tab to show for a `?tab=` value: aliases resolved, unknown or foreign tabs fall back to the overview. */
export function panelTab(requested: string | null, tabs: PanelTab[]): PanelTabId {
  const id = requested ? ALIASES[requested] ?? requested : "genel";
  if (tabs.some((tab) => tab.id === id)) return id as PanelTabId;
  // "Firmanızı ekleyin" links from other account types land where the account type is changed.
  return id === "muteahhit" || id === "hizmet" ? "profil" : "genel";
}

export const ACCOUNT_KIND_LABELS: Record<AccountKind, string> = { individual: "Bireysel", agent: "Emlakçı", contractor: "Müteahhit", service: "Hizmet firması" };
