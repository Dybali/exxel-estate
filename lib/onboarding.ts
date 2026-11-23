// "Hesabınızı hazırlayın": the start checklist at the top of Hesabım › Genel Bakış (components/StartChecklist.tsx),
// one list per account type (owner's request 2026-11-23: make the features easy to understand). A step is done
// when the data says so; the browser adds the steps that are only "have a look" (seen the request board).
// Pure step logic here; the facts come from onboardingFacts below. Missing tables simply count as "not yet".
import type { AccountKind } from "./account-kind";

export type OnboardingFacts = {
  avatar: boolean; phone: boolean; listings: number; officeDocument: boolean; languages: boolean;
  favorites: number; savedSearches: number; homeRequests: number;
  firm: boolean; firmAreas: number; firmDocuments: number; firmProjects: number; firmPlan: boolean;
};
export type OnboardingStep = { id: string; title: string; text: string; href: string; done: boolean };

export function onboardingSteps(kind: AccountKind, facts: OnboardingFacts, seen: { leadBoard?: boolean } = {}): OnboardingStep[] {
  const step = (id: string, title: string, text: string, href: string, done: boolean) => ({ id, title, text, href, done });
  switch (kind) {
    case "agent": return [
      step("photo", "Profil fotoğrafı ekleyin", "Fotoğraflı danışmanlara alıcılar daha çok güvenir.", "/hesabim?tab=profil", facts.avatar),
      step("licence", "Yetki belgenizi yükleyin", "Onaylı emlakçı rozeti ve Talep akışı belge onayıyla açılır.", "/hesabim?tab=firma", facts.officeDocument),
      step("listing", "İlk ilanınızı verin", "İlanınız 10 dile çevrilir ve yurt dışındaki alıcılara da ulaşır.", "/ilan-ver", facts.listings > 0),
      step("languages", "Konuştuğunuz dilleri seçin", "Danışmanlar sayfasında dil filtresinde görünürsünüz.", "/hesabim?tab=profil#diller", facts.languages),
      step("board", "Talep akışına göz atın", "Ev arayan alıcıların talepleri burada; beğendiğinize teklif gönderin.", "/hesabim?tab=talep-akisi", Boolean(seen.leadBoard)),
    ];
    case "service": return [
      step("firm", "Firma bilgilerinizi girin", "Firma adı, açıklama ve hizmet kategorileri.", "/hesabim?tab=hizmet", facts.firm),
      step("areas", "Hizmet bölgelerinizi seçin", "Teklif talepleri seçtiğiniz il ve ilçelerden gelir.", "/hesabim?tab=hizmet", facts.firmAreas > 0),
      step("documents", "Belgelerinizi yükleyin", "Belgeli firmalar aramalarda öne çıkar.", "/hesabim?tab=hizmet", facts.firmDocuments > 0),
      step("plan", "Paketinizi seçin", "Plus ve Pro ile daha çok fotoğraf ve müşteriyle mesajlaşma.", "/hizmetler/paketler", facts.firmPlan),
    ];
    case "contractor": return [
      step("firm", "Firma bilgilerinizi girin", "Firma adı, açıklama ve iletişim bilgileri.", "/hesabim?tab=muteahhit", facts.firm),
      step("areas", "Çalıştığınız bölgeleri seçin", "Kat karşılığı talepleri seçtiğiniz bölgelerden gelir.", "/hesabim?tab=muteahhit", facts.firmAreas > 0),
      step("projects", "Tamamlanan bir proje ekleyin", "Fotoğraflı projeler arsa sahiplerinin güvenini artırır.", "/hesabim?tab=muteahhit", facts.firmProjects > 0),
      step("plan", "Paketinizi seçin", "Plus ve Pro ile kat karşılığı talepleri ve mesajlaşma.", "/muteahhitler/paketler", facts.firmPlan),
    ];
    default: return [
      step("phone", "Telefon numaranızı ekleyin", "İlan sahipleri ve danışmanlar size daha kolay ulaşır.", "/hesabim?tab=profil", facts.phone),
      step("favorite", "Bir ilanı favorilere ekleyin", "Beğendiğiniz ilanlarda kalp simgesine dokunun; fiyatı düşerse haber verelim.", "/ilanlar", facts.favorites > 0),
      step("search", "Aramanızı kaydedin", "İlanlar sayfasında Aramayı kaydet deyin; yeni ilanlar e-postanıza gelsin.", "/ilanlar", facts.savedSearches > 0),
      step("request", "Benim için bul talebi bırakın", "Aradığınız evi anlatın, danışmanlar size tekliflerle dönsün.", "/benim-icin-bul", facts.homeRequests > 0),
    ];
  }
}

interface Statement { bind(...values: (string | number | null)[]): Statement; first<T = Record<string, unknown>>(): Promise<T | null> }
export type OnboardingDatabase = { prepare(sql: string): Statement };
const count = async (db: OnboardingDatabase, sql: string, ...values: string[]) => {
  try { return Number((await db.prepare(sql).bind(...values).first<{ n: number }>())?.n) || 0; } catch { return 0; }
};

/** Facts for one account; each query on its own so a table that does not exist yet just reads as zero. */
export async function onboardingFacts(db: OnboardingDatabase, user: { id: string; avatar_url?: string | null; phone?: string | null }, at = new Date()): Promise<OnboardingFacts> {
  const id = String(user.id), stamp = at.toISOString();
  const serviceFirm = await count(db, "SELECT COUNT(*) AS n FROM service_firms WHERE owner_id=?", id);
  const contractorFirm = await count(db, "SELECT COUNT(*) AS n FROM contractor_firms WHERE owner_id=?", id);
  return {
    avatar: Boolean(user.avatar_url), phone: Boolean(user.phone),
    listings: await count(db, "SELECT COUNT(*) AS n FROM listings WHERE CAST(owner_id AS TEXT)=?", id),
    officeDocument: await count(db, "SELECT COUNT(*) AS n FROM office_verifications WHERE user_id=? AND state IN ('pending','approved')", id) > 0,
    languages: await count(db, "SELECT COUNT(*) AS n FROM agent_languages WHERE user_id=? AND languages<>'[]'", id) > 0,
    favorites: await count(db, "SELECT COUNT(*) AS n FROM favorites WHERE user_id=?", id),
    savedSearches: await count(db, "SELECT COUNT(*) AS n FROM saved_searches WHERE user_id=?", id),
    homeRequests: await count(db, "SELECT COUNT(*) AS n FROM home_requests WHERE user_id=?", id),
    firm: serviceFirm + contractorFirm > 0,
    firmAreas: await count(db, "SELECT COUNT(*) AS n FROM service_firm_areas a JOIN service_firms f ON f.id=a.firm_id WHERE f.owner_id=?", id)
      + await count(db, "SELECT COUNT(*) AS n FROM contractor_areas a JOIN contractor_firms f ON f.id=a.firm_id WHERE f.owner_id=?", id),
    firmDocuments: await count(db, "SELECT COUNT(*) AS n FROM service_firm_documents d JOIN service_firms f ON f.id=d.firm_id WHERE f.owner_id=?", id),
    firmProjects: await count(db, "SELECT COUNT(*) AS n FROM contractor_projects p JOIN contractor_firms f ON f.id=p.firm_id WHERE f.owner_id=?", id),
    firmPlan: await count(db, "SELECT COUNT(*) AS n FROM firm_plans WHERE user_id=? AND plan<>'free' AND ends_at>?", id, stamp) > 0,
  };
}
