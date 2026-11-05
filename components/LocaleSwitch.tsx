"use client";
import { ChevronDown, Globe2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { locales, useLocale } from "@/lib/i18n";

// Language menu of the site header (components/Header.tsx) and the service header
// (components/ServiceHeader.tsx). Closes on an outside click and on Escape.
export function LocaleSwitch({ className = "" }: { className?: string }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const { locale, setLocale } = useLocale();
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => { if (menu.current && !menu.current.contains(event.target as Node)) menu.current.open = false; };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menu.current?.open) { menu.current.open = false; menu.current.querySelector("summary")?.focus(); }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => { document.removeEventListener("pointerdown", closeOutside); document.removeEventListener("keydown", closeEscape); };
  }, []);
  const current = locales.find((item) => item.code === locale) || locales[0];
  return <details className={`locale-switch ${className}`.trim()} ref={menu}><summary aria-label={`Dil / Language: ${current.label}`}><Globe2 size={15} aria-hidden="true"/><span className="locale-hint">Dil / Language</span><img src={`/flags/${current.flag}.svg`} alt="" width={20} height={15}/><strong>{current.label}</strong><ChevronDown size={14} aria-hidden="true"/></summary><div className="locale-options">{locales.map((item) => <button type="button" key={item.code} lang={item.code} aria-label={`Dil: ${item.label}`} className={locale === item.code ? "active" : ""} aria-current={locale === item.code ? "true" : undefined} onClick={() => { setLocale(item.code); if (menu.current) menu.current.open = false; }}><img src={`/flags/${item.flag}.svg`} alt="" width={22} height={17}/><span>{item.label}</span></button>)}</div></details>;
}
