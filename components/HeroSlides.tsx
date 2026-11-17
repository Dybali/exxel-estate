"use client";
import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n";

// Home page hero (owner's request 2026-11-17): licensed photos that zoom in slowly and cross-fade every
// SLIDE_SECONDS. The first photo is the page's LCP image and loads at once; the others load after the page
// is idle. Visitors who ask for reduced motion get the first photo only; rotation pauses in hidden tabs.
// Sources: docs/visual-sources.md.
type Slide = { src: string; srcSet?: string; position: string; credit: { label: string; url: string } };
export const HERO_SLIDES: Slide[] = [
  { src: "/villa-sunset-1920.webp", srcSet: "/villa-sunset-720.webp 720w, /villa-sunset-1280.webp 1280w, /villa-sunset-1920.webp 1920w", position: "center 56%", credit: { label: "Ahmet ÇÖTÜR / Pexels", url: "https://www.pexels.com/photo/luxurious-modern-villa-with-infinity-pool-at-sunset-31817157/" } },
  { src: "/antalya-mediterranean.webp", position: "center 62%", credit: { label: "Vlada Karpovich / Pexels", url: "https://www.pexels.com/photo/villa-with-a-scenic-view-of-the-sea-7902904/" } },
  { src: "/editorial/photo-1613490493576-7fde63acd811.webp", position: "center 45%", credit: { label: "Unsplash", url: "https://images.unsplash.com/photo-1613490493576-7fde63acd811" } },
  { src: "/editorial/photo-1600596542815-ffad4c1539a9.webp", position: "center 50%", credit: { label: "Unsplash", url: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9" } },
];
export const SLIDE_SECONDS = 7;

export function HeroSlides() {
  const { t } = useLocale();
  const [active, setActive] = useState(0), [loaded, setLoaded] = useState(false), [still, setStill] = useState(false);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) { setStill(true); return; }
    // Load the other photos only once the page is idle, so they never compete with the first paint.
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    const start = () => setLoaded(true);
    const handle = idle ? idle(start) : window.setTimeout(start, 1500);
    return () => { if (!idle) window.clearTimeout(handle); };
  }, []);
  useEffect(() => {
    if (!loaded || still) return;
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") setActive((value) => (value + 1) % HERO_SLIDES.length); }, SLIDE_SECONDS * 1000);
    return () => window.clearInterval(timer);
  }, [loaded, still]);
  const credit = HERO_SLIDES[active].credit;
  return <>
    <div className={`market-hero-media hero-slides${still ? " hero-still" : ""}`} aria-hidden="true">
      {HERO_SLIDES.map((slide, index) => (index === 0 || loaded) && <img key={slide.src} src={slide.src} srcSet={slide.srcSet} sizes="100vw" alt=""
        className={index === active ? "hero-slide active" : "hero-slide"} style={{ objectPosition: slide.position }}
        loading={index === 0 ? "eager" : "lazy"} fetchPriority={index === 0 ? "high" : "low"} decoding="async"/>)}
    </div>
    <span className="hero-photo-credit">{t("Fotoğraf")}: <a href={credit.url} target="_blank" rel="noreferrer">{credit.label}</a></span>
  </>;
}
