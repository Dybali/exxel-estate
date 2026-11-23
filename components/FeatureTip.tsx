"use client";
import { useEffect, useState } from "react";
import Link from "@/components/SafeLink";
import { Lightbulb, X } from "lucide-react";
import { useLocale } from "@/lib/i18n";

// One-time tip at the top of a feature (owner's request 2026-11-23): shown until the member presses "Anladım",
// remembered in this browser. Never more than one per page; no pop-up, it sits in the page flow.
const DISMISSED = "em24_tips_dismissed", VISITED = "em24_features_visited";
const read = (key: string): string[] => { try { const value = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(value) ? value : []; } catch { return []; } };
const add = (key: string, id: string) => { try { const list = read(key); if (!list.includes(id)) localStorage.setItem(key, JSON.stringify([...list, id].slice(-50))); } catch { /* not remembered */ } };
/** The member has opened this feature at least once (the start checklist counts it as a step). */
export const tipSeen = (id: string) => typeof window !== "undefined" && (read(VISITED).includes(id) || read(DISMISSED).includes(id));
export const markVisited = (id: string) => add(VISITED, id);

export function FeatureTip({ id, title, text, more }: { id: string; title: string; text: string; more?: { href: string; label: string } }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(!read(DISMISSED).includes(id)); markVisited(id); }, [id]);
  if (!open) return null;
  const close = () => { add(DISMISSED, id); setOpen(false); };
  return <aside className="feature-tip" role="note" aria-label={t(title)}>
    <span className="feature-tip-icon"><Lightbulb size={18} aria-hidden="true"/></span>
    <div><strong>{t(title)}</strong><p>{t(text)}{more && <> <Link href={more.href}>{t(more.label)}</Link></>}</p></div>
    <button type="button" className="feature-tip-ok" onClick={close}>{t("Anladım")}</button>
    <button type="button" className="feature-tip-close" onClick={close} aria-label={t("Kapat")}><X size={16}/></button>
  </aside>;
}
