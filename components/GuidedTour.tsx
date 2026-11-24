"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Compass, X } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { useCookieConsent } from "./CookieConsent";

// Home page tour (owner's request 2026-11-23): a pop-up that walks a visitor through the page. Each step lights up
// one part of the page and explains it next to it; Next / Back / Close, arrow keys and Escape. Offered once, after
// the cookie choice, in a small welcome card; started again with the "Yardım" link in the top bar or /?tur=1.
// Steps whose part is not on screen (phone layout) are skipped.
export type Step = { target?: string; title: string; text: string };
export const HOME_TOUR: Step[] = [
  { title: "estatemarket24'e hoş geldiniz", text: "Bir dakikalık turla sitenin en kullanışlı yerlerini gösterelim. İstediğiniz an kapatabilirsiniz." },
  { target: ".home-search", title: "Buradan arayın", text: "Satılık veya kiralık, şehir ve gayrimenkul tipini seçin. Haritada ara ile sonuçları harita üzerinde görün." },
  { target: ".market-shortcuts", title: "Hızlı geçişler", text: "Satın almak, kiralamak, şirketlere bakmak veya il il emlak piyasasını görmek için tek dokunuş." },
  { target: ".ffm", title: "Benim için bul", text: "Aradığınız evi bir kez anlatın; bölgeyi bilen en fazla 4 danışman size uygun evlerle teklif göndersin. Ücretsiz." },
  { target: ".home-tools", title: "Karar araçları", text: "Evinizin değerini öğrenin, fiyatı düşen ilanları görün ya da Benim için bul ile aradığınız evi danışmanlara anlatın." },
  { target: ".market-map-section", title: "Haritadan keşfedin", text: "Haritada bir ile dokunun; o ildeki ilanlara geçin." },
  { target: ".icon-link", title: "Favorileriniz", text: "Beğendiğiniz ilanlar burada toplanır; fiyatı düşerse size haber veririz." },
  { target: ".header-post", title: "İlan verin", text: "Ücretsiz üye olun ve ilanınızı verin; ilanınız 10 dile çevrilir." },
  { target: ".locale-switch", title: "Dil ve para birimi", text: "Siteyi 10 dilden birinde kullanın; fiyatları istediğiniz para biriminde görün." },
  { target: ".assistant-launcher", title: "estateAI asistanı", text: "Aradığınız evi kendi cümlelerinizle yazın, asistan uygun ilanları bulsun." },
  { target: ".top-help-link", title: "Yardım her zaman burada", text: "Bu turu tekrar başlatmak veya adım adım rehberleri okumak için Yardım'a dokunun." },
];
// Hesabım tours (owner's request 2026-11-24): the same pop-up walks a member through the account panel. Menu
// items are found by data-tab (components/Dashboard.tsx); steps whose part is not on screen are skipped.
const tab = (id: string) => `.account-nav [data-tab="${id}"]`;
export const PANEL_PRO_TOUR: Step[] = [
  { title: "Emlak panelinize hoş geldiniz", text: "Bir dakikada panelin bölümlerini gösterelim: rakamlarınız, talepler, müşterileriniz ve ofisiniz. İstediğiniz an kapatabilirsiniz." },
  { target: ".pro-topbar", title: "Üst çubuk", text: "Mesajlar, bildirimler, yardım ve profiliniz her sayfada burada. Zil; yeni mesajları, randevu taleplerini ve yeni alıcı taleplerini listeler." },
  { target: ".ov-kpis", title: "Ana rakamlarınız", text: "Yayındaki ilan, görüntülenme, iletişim ve yanıt bekleyen müşteri. Ok işareti önceki döneme göre değişimi gösterir." },
  { target: ".ov-chart-card", title: "Görüntülenme ve iletişim", text: "İlanlarınızın günlük ilgisi. Üstten 7, 30 veya 90 günü seçin; grafiğin üzerine gelince günün sayıları çıkar." },
  { target: ".ov-top", title: "En çok ilgi gören ilanınız", text: "İlan sağlığı puanı ve kısa bir öneriyle birlikte. Puan düşükse fotoğraf, açıklama veya fiyatı gözden geçirin." },
  { target: ".ov-todo", title: "Bugün yapılacaklar", text: "Yanıt bekleyen müşteriler, onay bekleyen randevular, yeni talepler ve süresi dolacak ilanlar. Satıra dokununca ilgili bölüm açılır." },
  { target: ".ov-table-card", title: "İlanlarım tablosu", text: "Bütün ilanlarınız tek listede: fiyat, görüntülenme, iletişim, sağlık puanı ve kalan gün." },
  { target: tab("talep-akisi"), title: "Talep akışı", text: "Benim için bul ile ev arayan alıcıların talepleri. Size uyana teklif gönderin veya telefonu açın; bir talebe en fazla 4 danışman ulaşır." },
  { target: tab("mesajlar"), title: "Mesajlar", text: "Alıcılarla yazışmalarınız; mesajlar anında gelir ve sizin dilinize çevrilir." },
  { target: tab("crm"), title: "CRM", text: "İlan istatistikleri, müşteri talepleri ve yer gösterme randevuları; ilan başına öneriler." },
  { target: tab("firma"), title: "Ofis bilgilerim", text: "Ofis bilgileriniz ve yetki belgeniz. Belgeniz onaylanınca ilanlarınız beklemeden yayımlanır ve Talep akışı açılır." },
  { target: tab("ekip"), title: "Ekibim", text: "Danışmanlarınızı davet kodu veya WhatsApp bağlantısıyla ekleyin; ofisinizin altında görünürler." },
  { target: tab("siparisler"), title: "Paketler ve siparişler", text: "Profesyonel veya Prestij paketiyle Talep akışında daha fazla talebe ulaşın; Prestij yeni talepleri ilk 24 saat görür." },
  { target: tab("profil"), title: "Profilim", text: "Fotoğrafınız, tanıtım yazınız ve konuştuğunuz diller. Danışmanlar sayfasında böyle görünürsünüz." },
  { target: ".panel-tour-button", title: "Turu tekrar izleyin", text: "Bu turu istediğiniz zaman buradan yeniden başlatabilirsiniz; ayrıntılı rehberler Yardım merkezinde." },
];
export const PANEL_MEMBER_TOUR: Step[] = [
  { title: "Hesabınıza hoş geldiniz", text: "Bir dakikada hesabınızın bölümlerini gösterelim. İstediğiniz an kapatabilirsiniz." },
  { target: ".start-checklist", title: "Başlangıç listesi", text: "Hesabınızı hazırlamak için birkaç kısa adım. Bitirdikçe işaretlenir." },
  { target: tab("favoriler"), title: "Favorilerim", text: "Kalp simgesine dokunduğunuz ilanlar burada; fiyatı düşerse size haber veririz." },
  { target: tab("aramalar"), title: "Aramalarım ve bildirimler", text: "Kayıtlı aramalarınız, e-posta bildirimleriniz ve Benim için bul talepleriniz; danışmanların teklifleri de burada." },
  { target: tab("ilanlarim"), title: "İlanlarım", text: "Verdiğiniz ilanlar, taslaklarınız ve istatistikleri." },
  { target: tab("mesajlar"), title: "Mesajlar", text: "İlan sahipleri ve danışmanlarla yazışmalarınız; mesajlar anında gelir ve dilinize çevrilir." },
  { target: tab("randevular"), title: "Randevularım", text: "İstediğiniz yer gösterme randevuları ve durumları. Onaylanınca e-posta da gelir." },
  { target: tab("ekip"), title: "Ofis ekibi", text: "Bir emlak ofisinde danışmansanız ofisinizin davet koduyla buradan katılın." },
  { target: tab("profil"), title: "Profilim", text: "Adınız, telefonunuz, fotoğrafınız ve e-posta tercihleriniz." },
  { target: ".panel-tour-button", title: "Turu tekrar izleyin", text: "Bu turu istediğiniz zaman buradan yeniden başlatabilirsiniz; ayrıntılı rehberler Yardım merkezinde." },
];
export const TOURS = {
  home: { steps: HOME_TOUR, store: "em24_home_tour", welcomeTitle: "Siteyi tanıyalım mı?", welcomeText: "Bir dakikalık kısa turla aramayı, araçları ve ilan vermeyi gösterelim." },
  "panel-pro": { steps: PANEL_PRO_TOUR, store: "em24_panel_tour_pro", welcomeTitle: "Panelinizi tanıyalım mı?", welcomeText: "Bir dakikalık turla rakamlarınızı, Talep akışını, müşterilerinizi ve ofis ayarlarını gösterelim." },
  "panel-member": { steps: PANEL_MEMBER_TOUR, store: "em24_panel_tour_member", welcomeTitle: "Hesabınızı tanıyalım mı?", welcomeText: "Bir dakikalık turla favorileri, aramaları, mesajları ve randevuları gösterelim." },
} as const;
export type TourName = keyof typeof TOURS;
export const START_TOUR_EVENT = "em24:start-tour";
const visible = (selector?: string) => { if (!selector) return null; const element = document.querySelector<HTMLElement>(selector); if (!element) return null; const rect = element.getBoundingClientRect(); return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== "hidden" ? element : null; };

export function GuidedTour({ tour = "home" }: { tour?: TourName }) {
  const { t } = useLocale();
  const { steps: TOUR_STEPS, store: STORE, welcomeTitle, welcomeText } = TOURS[tour];
  const { consent } = useCookieConsent();
  const [mode, setMode] = useState<"off" | "welcome" | "tour">("off");
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const steps = useRef<Step[]>([...TOUR_STEPS]);
  const remember = (value: string) => { try { localStorage.setItem(STORE, value); } catch { /* not remembered */ } };
  const start = useCallback(() => { steps.current = TOUR_STEPS.filter((step) => !step.target || visible(step.target)); setIndex(0); setMode("tour"); }, [TOUR_STEPS]);
  // Offer once, a moment after the cookie choice, unless the link asks for it (?tur=1).
  // Each runs once per page view (the consent value is a new object on every render, which restarted the tour).
  const hasConsent = Boolean(consent);
  useEffect(() => {
    if (new URLSearchParams(location.search).get("tur") !== "1") return;
    const timer = setTimeout(start, 600);
    return () => clearTimeout(timer);
  }, [start]);
  useEffect(() => {
    if (!hasConsent || new URLSearchParams(location.search).get("tur") === "1") return;
    let seen = false; try { seen = Boolean(localStorage.getItem(STORE)); } catch { seen = true; }
    if (seen) return;
    const timer = setTimeout(() => setMode((current) => current === "off" ? "welcome" : current), 2500);
    return () => clearTimeout(timer);
  }, [hasConsent, STORE]);
  useEffect(() => { const open = () => start(); window.addEventListener(START_TOUR_EVENT, open); return () => window.removeEventListener(START_TOUR_EVENT, open); }, [start]);
  const step = steps.current[index];
  const close = useCallback(() => { setMode("off"); setRect(null); remember("done"); }, [STORE]);
  const go = useCallback((delta: number) => { const next = index + delta; if (next < 0) return; if (next >= steps.current.length) { close(); return; } setIndex(next); }, [index, close]);
  // Light up the current part: scroll it into view, then follow it while the page moves.
  useLayoutEffect(() => {
    if (mode !== "tour") return;
    const element = visible(step?.target);
    if (!element) { setRect(null); return; }
    element.scrollIntoView({ block: "center", behavior: "smooth" });
    const update = () => setRect(element.getBoundingClientRect());
    update(); const timer = setTimeout(update, 450);
    window.addEventListener("scroll", update, { passive: true }); window.addEventListener("resize", update);
    return () => { clearTimeout(timer); window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, [mode, index, step]);
  useEffect(() => {
    if (mode === "off") return;
    card.current?.focus();
    const keys = (event: KeyboardEvent) => { if (event.key === "Escape") close(); if (mode === "tour" && event.key === "ArrowRight") go(1); if (mode === "tour" && event.key === "ArrowLeft") go(-1); };
    document.addEventListener("keydown", keys); return () => document.removeEventListener("keydown", keys);
  }, [mode, index, go, close]);
  if (mode === "off") return null;
  if (mode === "welcome") return <div className="tour-welcome" role="dialog" aria-modal="false" aria-labelledby="tour-welcome-title" ref={card} tabIndex={-1}>
    <span className="tour-welcome-icon"><Compass size={22} aria-hidden="true"/></span>
    <div><strong id="tour-welcome-title">{t(welcomeTitle)}</strong><p>{t(welcomeText)}</p>
      <div className="tour-actions"><button type="button" className="small-primary" onClick={start}>{t("Turu başlat")}</button><button type="button" className="outline-button" onClick={close}>{t("Şimdi değil")}</button></div></div>
    <button type="button" className="tour-close" onClick={close} aria-label={t("Kapat")}><X size={18}/></button>
  </div>;
  // The card goes under the lit part, else above it; when neither fits (a tall section on a phone) it sits at the
  // bottom of the screen over the section. It always stays fully on screen.
  const pad = 8, cardHeight = card.current?.offsetHeight || 230, gap = 14, margin = 12, height = window.innerHeight;
  const cardTop = !rect ? 0 : rect.bottom + gap + cardHeight <= height - margin ? rect.bottom + gap
    : rect.top - gap - cardHeight >= margin ? rect.top - gap - cardHeight : height - cardHeight - margin;
  // A narrow part with room on its right (a menu item) gets the card beside it, level with it.
  const cardWidth = Math.min(340, window.innerWidth - 24), beside = rect && rect.width < 360 && window.innerWidth - rect.right - gap - margin >= cardWidth;
  const position: React.CSSProperties = !rect ? { top: "50%", left: "50%", transform: "translate(-50%,-50%)" }
    : beside ? { top: Math.max(margin, Math.min(rect.top + rect.height / 2 - cardHeight / 2, height - cardHeight - margin)), left: rect.right + gap }
    : { top: Math.max(margin, Math.min(cardTop, height - cardHeight - margin)), left: Math.min(Math.max(rect.left + rect.width / 2 - 170, margin), window.innerWidth - cardWidth - margin) };
  return <div className="tour-layer">
    {rect ? <div className="tour-spotlight" style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} aria-hidden="true"/> : <div className="tour-dim" onClick={close} aria-hidden="true"/>}
    <div className="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title" style={position} ref={card} tabIndex={-1}>
      <span className="tour-count">{index + 1} / {steps.current.length}</span>
      <strong id="tour-title">{t(step.title)}</strong>
      <p>{t(step.text)}</p>
      <div className="tour-actions">
        {index > 0 && <button type="button" className="outline-button" onClick={() => go(-1)}><ArrowLeft size={15} aria-hidden="true"/>{t("Geri")}</button>}
        <button type="button" className="small-primary" onClick={() => go(1)}>{t(index === steps.current.length - 1 ? "Bitir" : "İleri")}{index < steps.current.length - 1 && <ArrowRight size={15} aria-hidden="true"/>}</button>
      </div>
      <button type="button" className="tour-close" onClick={close} aria-label={t("Turu kapat")}><X size={18}/></button>
    </div>
  </div>;
}
