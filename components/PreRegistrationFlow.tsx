"use client";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import type { LandingCity } from "@/lib/landing-cities";
import { PACKAGES, PORTFOLIO_SIZES, PROPERTY_COUNTS, PROPERTY_TYPES, PURPOSES, TIMELINES, YES_NO } from "@/lib/pre-registrations";

// One-question-per-screen pre-registration (Typeform style) for a city landing page. Turkish only: the copy is
// the owner's campaign brief (2026-11-20). Answers go to POST /api/on-kayit; UTM and gclid travel along.
type Values = Record<string, string | boolean>;
type Step = { key: string; title: string; kind: "choice" | "text" | "tel" | "email"; options?: readonly (string | readonly [string, string])[]; required?: boolean; placeholder?: string };

const FEATURES = [
  "Tek tıkla 3,2 milyar insana ulaşım",
  "İlanlarınız otomatik olarak 8 dilde yayında",
  "Canlı çeviri ile yabancı alıcılarla kendi dilinizde mesajlaşma",
  "İlk 1000 emlakçıya %50 hediye",
  "Bireysel mülk sahiplerine erken kayıt ayrıcalığı",
  "Onaylı ve doğrulanmış ilanlarla güvenilir profil",
];
// Headline figures shown large on the welcome screen (owner's request: emphasise them like an ad).
const HIGHLIGHTS: readonly (readonly [string, string])[] = [["109", "ülke"], ["8", "dil"], ["Canlı", "çeviriyle mesajlaşma"], ["%50", "ilk 1000 emlakçıya hediye"]];
const COPY = {
  title: "Tek tıkla 3,2 milyar insana ulaşın", cta: "Hemen yerinizi ayırtın", ok: "Tamam", back: "Geri", skip: "Geç", send: "Ön kaydı tamamla", sending: "Gönderiliyor…",
  consentTitle: "Son adım", notice: "KVKK Aydınlatma Metni’ni okudum ve kabul ediyorum.", noticeLink: "Aydınlatma Metni", marketing: "Kampanya ve bilgilendirme mesajları almak istiyorum.",
  thanksTitle: "Yeriniz ayrıldı! 🎉", explore: "EstateMarket24’ü keşfedin", photo: "Fotoğraf", enter: "Enter ↵", required: "Bu soru zorunlu.",
  name: "Adınızı ve soyadınızı girin.", company: "Emlak ofisinizin adını girin.", phone: "Geçerli bir cep telefonu numarası girin.", email: "Geçerli bir e-posta adresi girin.",
  noticeMissing: "Devam etmek için Aydınlatma Metni’ni onaylayın.", failed: "Kayıt şu anda gönderilemedi. Lütfen tekrar deneyin.",
};
const EMAIL = /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[^\s@<>()",;]{2,}$/;
const LETTERS = "ABCDEFGH";

function stepsFor(role: string, city: LandingCity): Step[] {
  const contact: Step[] = [
    { key: "phone", title: "Cep telefonunuz", kind: "tel", required: true, placeholder: "05xx xxx xx xx" },
    { key: "email", title: "E-posta adresiniz", kind: "email", required: true, placeholder: "ornek@eposta.com" },
  ];
  if (role === "agent") return [
    { key: "name", title: "Adınız soyadınız", kind: "text", required: true },
    { key: "company", title: "Emlak ofisinizin adı", kind: "text", required: true },
    ...contact,
    { key: "district", title: `Ofisiniz ${city.genitive} hangi ilçesinde?`, kind: "text" },
    { key: "portfolio", title: "Portföyünüzde yaklaşık kaç ilan var?", kind: "choice", options: PORTFOLIO_SIZES },
    { key: "foreignSales", title: "Daha önce yabancı müşteriye satış yaptınız mı?", kind: "choice", options: YES_NO },
    { key: "package", title: "Hangi paketle ilgileniyorsunuz?", kind: "choice", options: PACKAGES },
  ];
  return [
    { key: "name", title: "Adınız soyadınız", kind: "text", required: true },
    ...contact,
    { key: "district", title: `Mülkünüz ${city.genitive} hangi ilçesinde?`, kind: "text" },
    { key: "propertyType", title: "Mülkünüzün türü nedir?", kind: "choice", options: PROPERTY_TYPES },
    { key: "propertyCount", title: "Kaç mülkünüzü ilana çıkarmayı düşünüyorsunuz?", kind: "choice", options: PROPERTY_COUNTS },
    { key: "purpose", title: "Mülkünüzü ne için ilana çıkarmak istiyorsunuz?", kind: "choice", options: PURPOSES },
    { key: "timeline", title: "Ne zaman ilana çıkmayı planlıyorsunuz?", kind: "choice", options: TIMELINES },
  ];
}
const ROLE_STEP: Step = { key: "role", title: "Size nasıl yardımcı olabiliriz?", kind: "choice", required: true, options: [["agent", "Emlakçıyım / emlak ofisi sahibiyim"], ["owner", "Bireysel mülk sahibiyim"]] };

function problem(step: Step, value: string) {
  if (step.key === "name" && value.trim().length < 3) return COPY.name;
  if (step.key === "company" && value.trim().length < 2) return COPY.company;
  if (step.kind === "tel") { const digits = value.replace(/\D/g, ""); if (digits.length < 10 || digits.length > 15) return COPY.phone; }
  if (step.kind === "email" && !EMAIL.test(value.trim())) return COPY.email;
  if (step.required && !value.trim()) return COPY.required;
  return "";
}

export function PreRegistrationFlow({ city, siteHref }: { city: LandingCity; siteHref: string }) {
  const [screen, setScreen] = useState(-1); // -1 welcome, 0..n-1 questions, n consent, n+1 thanks
  const [values, setValues] = useState<Values>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [gift, setGift] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const tracking = useRef<Record<string, string>>({});
  const input = useRef<HTMLInputElement>(null);
  const role = String(values.role || "");
  const steps = useMemo(() => [ROLE_STEP, ...(role ? stepsFor(role, city) : [])], [role, city]);
  const consentScreen = steps.length, thanksScreen = steps.length + 1;
  const label = `${city.locative.toLocaleUpperCase("tr")} EMLAKÇILARA VE MÜLK SAHİPLERİNE ÖZEL`;
  const urgency = `Kontenjan sınırlı. ${city.name} için yerinizi şimdi ayırtın.`;

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid"]) { const v = q.get(key); if (v) tracking.current[key] = v.slice(0, 200); }
  }, []);
  useEffect(() => { setMessage(""); const t = window.setTimeout(() => input.current?.focus(), 60); return () => window.clearTimeout(t); }, [screen]);

  const step = screen >= 0 && screen < steps.length ? steps[screen] : null;
  const current = step ? String(values[step.key] || "") : "";
  const next = () => setScreen((s) => s + 1);
  function answer(value: string) {
    if (!step) return;
    setValues((old) => ({ ...old, [step.key]: value }));
    window.setTimeout(next, 160);
  }
  function submitText(event: FormEvent) {
    event.preventDefault();
    if (!step) return;
    const issue = problem(step, current);
    if (issue) { setMessage(issue); return; }
    next();
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (values.notice !== true) { setMessage(COPY.noticeMissing); return; }
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/on-kayit", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, ...tracking.current, city: city.slug, source: `landing-${city.slug}`, website: String(values.website || "") }) });
      const data = await response.json().catch(() => ({})) as { gift?: boolean; error?: string };
      if (!response.ok) throw new Error(response.status >= 500 ? COPY.failed : data.error || COPY.failed);
      setGift(Boolean(data.gift));
      const w = window as unknown as { gtag?: (...args: unknown[]) => void; dataLayer?: unknown[] };
      w.gtag?.("event", "generate_lead", { city: city.slug, role });
      w.dataLayer?.push({ event: "pre_registration", city: city.slug, role });
      setScreen(thanksScreen);
    } catch (cause) { setMessage((cause as Error).message || COPY.failed); }
    finally { setBusy(false); }
  }

  if (screen === -1) return <main className="lp lp-welcome">
    <header className="lp-top"><img className="lp-logo-dark" src="/brand/logo-horizontal.svg" alt="EstateMarket24" width={190} height={37}/></header>
    <section className="lp-grid">
      <figure className="lp-photo">
        {!photoFailed && <img src={city.image} alt={city.imageShowsLandmark ? `${city.name} · ${city.landmark}` : city.name} onError={() => setPhotoFailed(true)} loading="eager" fetchPriority="high"/>}
        <figcaption><strong>{city.name}</strong>{city.imageShowsLandmark ? <span>{city.landmark}</span> : null}</figcaption>
      </figure>
      <div className="lp-copy">
        <p className="lp-eyebrow">{label}</p>
        <h1>{COPY.title}</h1>
        <p className="lp-sub">{`${city.locative} mülklerinizi 8 dilde yayınlayın, yabancı alıcılarla canlı çeviriyle anında mesajlaşın.`}</p>
        <div className="lp-highlights">{HIGHLIGHTS.map(([big, small]) => <div key={small}><strong>{big}</strong><span>{small}</span></div>)}</div>
        <ul className="lp-features">{FEATURES.map((item) => <li key={item}><Check size={16} aria-hidden="true"/>{item}</li>)}</ul>
        <p className="lp-urgency">{urgency}</p>
        <button type="button" className="lp-cta" onClick={next}>{COPY.cta}<ArrowRight size={20}/></button>
      </div>
    </section>
    <p className="lp-credit">{`${COPY.photo}: ${city.credit.author} · `}<a href={city.credit.source} target="_blank" rel="noopener noreferrer">{city.credit.license}</a></p>
  </main>;

  if (screen === thanksScreen) {
    const text = role === "agent"
      ? `${city.locative} ilk emlakçılar arasındasınız. ${gift ? "%50 hediyeniz tanımlandı. " : ""}Ekibimiz en kısa sürede sizinle iletişime geçecek.`
      : `${city.locative} ilk mülk sahipleri arasındasınız. Mülkünüzü dünyanın dört bir yanındaki alıcılara ulaştırmak için ekibimiz en kısa sürede sizinle iletişime geçecek.`;
    return <main className="lp lp-screen lp-thanks"><div className="lp-card">
      <img className="lp-logo-dark" src="/brand/logo-horizontal.svg" alt="EstateMarket24" width={190} height={37}/>
      <h1>{COPY.thanksTitle}</h1><p>{text}</p>
      <a className="lp-cta" href={siteHref}>{COPY.explore}<ArrowRight size={20}/></a>
    </div></main>;
  }

  // Before the role is chosen the length is unknown; both paths have 9 questions plus the consent screen.
  const progress = Math.round(((screen + 1) / (role ? consentScreen + 1 : 10)) * 100);
  return <main className="lp lp-screen">
    <div className="lp-progress" aria-hidden="true"><span style={{ width: `${Math.min(progress, 100)}%` }}/></div>
    <div className="lp-card">
      <button type="button" className="lp-back" onClick={() => setScreen((s) => s - 1)}><ArrowLeft size={16}/>{COPY.back}</button>
      {step ? <form onSubmit={submitText} noValidate>
        <p className="lp-step">{`${screen + 1} →`}</p>
        <h2>{step.title}{step.required ? " *" : ""}</h2>
        {step.kind === "choice" ? <div className="lp-choices" role="radiogroup" aria-label={step.title}>
          {(step.options || []).map((option, index) => {
            const [value, text] = typeof option === "string" ? [option, option] : option;
            return <button key={value} type="button" role="radio" aria-checked={current === value} className={current === value ? "lp-choice selected" : "lp-choice"} onClick={() => answer(value)}>
              <span className="lp-key">{LETTERS[index]}</span>{text}{current === value && <Check size={18} aria-hidden="true"/>}
            </button>;
          })}
          {!step.required && <button type="button" className="lp-skip" onClick={next}>{COPY.skip}</button>}
        </div> : <>
          <input ref={input} className="lp-input" type={step.kind === "text" ? "text" : step.kind} inputMode={step.kind === "tel" ? "tel" : step.kind === "email" ? "email" : undefined}
            autoComplete={step.key === "name" ? "name" : step.key === "company" ? "organization" : step.kind === "tel" ? "tel" : step.kind === "email" ? "email" : "off"}
            placeholder={step.placeholder || ""} value={current} maxLength={step.key === "district" ? 80 : 200}
            onChange={(event) => { setMessage(""); setValues((old) => ({ ...old, [step.key]: event.target.value })); }}/>
          <div className="lp-actions"><button type="submit" className="lp-ok">{COPY.ok}<Check size={18}/></button><span className="lp-hint">{COPY.enter}</span></div>
        </>}
        {message && <p className="lp-error" role="alert">{message}</p>}
      </form> : <form onSubmit={send}>
        <h2>{COPY.consentTitle}</h2>
        <label className="lp-check"><input type="checkbox" checked={values.notice === true} onChange={(event) => setValues((old) => ({ ...old, notice: event.target.checked }))}/>
          <span>{COPY.notice} <a href="/gizlilik-politikasi" target="_blank" rel="noopener noreferrer">{COPY.noticeLink}</a> *</span></label>
        <label className="lp-check"><input type="checkbox" checked={values.marketing === true} onChange={(event) => setValues((old) => ({ ...old, marketing: event.target.checked }))}/><span>{COPY.marketing}</span></label>
        <input className="lp-honeypot" tabIndex={-1} autoComplete="off" aria-hidden="true" value={String(values.website || "")} onChange={(event) => setValues((old) => ({ ...old, website: event.target.value }))}/>
        <button type="submit" className="lp-cta" disabled={busy}>{busy ? COPY.sending : COPY.send}<ArrowRight size={20}/></button>
        {message && <p className="lp-error" role="alert">{message}</p>}
      </form>}
    </div>
  </main>;
}
