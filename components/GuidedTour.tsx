"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Compass, X } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { useCookieConsent } from "./CookieConsent";

// Home page tour (owner's request 2026-11-23): a pop-up that walks a visitor through the page. Each step lights up
// one part of the page and explains it next to it; Next / Back / Close, arrow keys and Escape. Offered once, after
// the cookie choice, in a small welcome card; started again with the "Yardım" link in the top bar or /?tur=1.
// Steps whose part is not on screen (phone layout) are skipped.
type Step = { target?: string; title: string; text: string };
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
const STORE = "em24_home_tour";
export const START_TOUR_EVENT = "em24:start-tour";
const visible = (selector?: string) => { if (!selector) return null; const element = document.querySelector<HTMLElement>(selector); if (!element) return null; const rect = element.getBoundingClientRect(); return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== "hidden" ? element : null; };

export function GuidedTour() {
  const { t } = useLocale();
  const { consent } = useCookieConsent();
  const [mode, setMode] = useState<"off" | "welcome" | "tour">("off");
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const steps = useRef<Step[]>(HOME_TOUR);
  const remember = (value: string) => { try { localStorage.setItem(STORE, value); } catch { /* not remembered */ } };
  const start = useCallback(() => { steps.current = HOME_TOUR.filter((step) => !step.target || visible(step.target)); setIndex(0); setMode("tour"); }, []);
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
  }, [hasConsent]);
  useEffect(() => { const open = () => start(); window.addEventListener(START_TOUR_EVENT, open); return () => window.removeEventListener(START_TOUR_EVENT, open); }, [start]);
  const step = steps.current[index];
  const close = useCallback(() => { setMode("off"); setRect(null); remember("done"); }, []);
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
    <div><strong id="tour-welcome-title">{t("Siteyi tanıyalım mı?")}</strong><p>{t("Bir dakikalık kısa turla aramayı, araçları ve ilan vermeyi gösterelim.")}</p>
      <div className="tour-actions"><button type="button" className="small-primary" onClick={start}>{t("Turu başlat")}</button><button type="button" className="outline-button" onClick={close}>{t("Şimdi değil")}</button></div></div>
    <button type="button" className="tour-close" onClick={close} aria-label={t("Kapat")}><X size={18}/></button>
  </div>;
  // The card goes under the lit part, else above it; when neither fits (a tall section on a phone) it sits at the
  // bottom of the screen over the section. It always stays fully on screen.
  const pad = 8, cardHeight = card.current?.offsetHeight || 230, gap = 14, margin = 12, height = window.innerHeight;
  const cardTop = !rect ? 0 : rect.bottom + gap + cardHeight <= height - margin ? rect.bottom + gap
    : rect.top - gap - cardHeight >= margin ? rect.top - gap - cardHeight : height - cardHeight - margin;
  const position: React.CSSProperties = rect
    ? { top: Math.max(margin, Math.min(cardTop, height - cardHeight - margin)), left: Math.min(Math.max(rect.left + rect.width / 2 - 170, margin), window.innerWidth - Math.min(340, window.innerWidth - 24) - margin) }
    : { top: "50%", left: "50%", transform: "translate(-50%,-50%)" };
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
