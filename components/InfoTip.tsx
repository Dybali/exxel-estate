"use client";
import { useEffect, useId, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";
import { useLocale } from "@/lib/i18n";

// Small "?" next to a term that needs a word of explanation (hizmet bedeli, sıcak talep, brüt getiri…). A tap
// opens two sentences; tap again, Escape or a tap elsewhere closes them. On phones it opens as a bottom sheet.
export function InfoTip({ label, text }: { label: string; text: string }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const id = useId(), box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (box.current && !box.current.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <span className="info-tip" ref={box}>
    <button type="button" className="info-tip-button" aria-expanded={open} aria-controls={id} aria-label={`${t(label)}: ${t("Açıklama")}`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setOpen((value) => !value); }}><HelpCircle size={15} aria-hidden="true"/></button>
    {open && <span className="info-tip-panel" id={id} role="tooltip"><strong>{t(label)}</strong>{t(text)}</span>}
  </span>;
}
