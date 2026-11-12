"use client";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Calculator, Languages, Play, Square } from "lucide-react";
import { apiJson } from "@/lib/api-client";
import { useLocale } from "@/lib/i18n";
import { BATCH_FACTOR, TRIAL_MODELS, TRIAL_VOLUME, trialEstimate, trialTargets, type TrialModel, type TrialResult } from "@/lib/translation-trial";
import type { ListingLanguage } from "@/lib/listing-language";

type Candidate = { id: string; title: string; source: ListingLanguage; chars: number };
const RTL = new Set(["ar", "fa"]);

// Admin view "Çeviri testi" (lib/translation-trial.ts): translates the latest published listings with Gemini,
// shows the translations next to the original and extrapolates the cost from Gemini's real token counts.
export function AdminTranslationTrial() {
  const { t, locale } = useLocale();
  const usd = (value: number, digits = 2) => new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
  const number = (value: number) => new Intl.NumberFormat(locale).format(Math.round(value));
  const [candidates, setCandidates] = useState<Candidate[] | null>(null), [providers, setProviders] = useState<Record<string, boolean>>({ gemini: true, openai: true });
  const [model, setModel] = useState<TrialModel>("gemini-3.5-flash-lite"), [count, setCount] = useState(5);
  const [results, setResults] = useState<TrialResult[]>([]), [running, setRunning] = useState(false), [stop, setStop] = useState(false), [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/admin/translation-trial", { cache: "no-store" }).then(async (response) => {
      const data = await apiJson<{ error?: string; listings: Candidate[]; providers: Record<string, boolean> }>(response);
      if (!response.ok) throw new Error(data.error || "İlanlar yüklenemedi.");
      setCandidates(data.listings); setProviders(data.providers);
    }).catch((cause) => setError((cause as Error).message));
  }, []);
  const stopRef = useRef(false);
  async function run() {
    if (!candidates?.length || running) return;
    stopRef.current = false; setRunning(true); setStop(false); setError(""); setResults([]);
    for (const listing of candidates.slice(0, count)) {
      if (stopRef.current) break;
      try {
        const response = await fetch("/api/admin/translation-trial", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: listing.id, model }) });
        const data = await apiJson<{ error?: string; result?: TrialResult }>(response);
        if (!response.ok || !data.result) throw new Error(data.error || "Çeviri testi başarısız oldu.");
        setResults((old) => [...old, data.result!]);
      } catch (cause) { setError((cause as Error).message); break; }
    }
    setRunning(false);
  }
  const provider = TRIAL_MODELS[model].provider, configured = providers[provider] !== false;
  const estimate = results.length ? trialEstimate(results) : null;
  const warnings = results.reduce((sum, item) => sum + item.missing.length + Object.values(item.translations).reduce((n, tr) => n + (tr?.warnings.length || 0), 0), 0);
  return <section className="admin-translation-trial">
    <div className="admin-section-title"><div><h2>{t("Çeviri testi")}</h2><p>{t("Son yayınlanan ilanları seçilen modelle 7 dile çevirir, modelin bildirdiği gerçek token sayısıyla maliyeti hesaplar. Hiçbir şey kaydedilmez; her ilan bir sentin altında tutar.")}</p></div></div>
    {!configured && <div className="admin-notice error" role="alert">{t(provider === "openai" ? "OPENAI_API_KEY ayarlı değil." : "GEMINI_API_KEY ayarlı değil.")}</div>}
    <div className="admin-card admin-trial-controls">
      <label>{t("Model")}<select value={model} disabled={running} onChange={(event) => setModel(event.target.value as TrialModel)}>{Object.entries(TRIAL_MODELS).map(([id, item]) => <option key={id} value={id}>{item.label} · {usd(item.input)} / {usd(item.output)}</option>)}</select></label>
      <label>{t("İlan sayısı")}<select value={count} disabled={running} onChange={(event) => setCount(Number(event.target.value))}>{[1, 3, 5, 10].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      {running ? <button type="button" className="admin-secondary" onClick={() => { stopRef.current = true; setStop(true); }} disabled={stop}><Square size={15}/>{t("Durdur")}</button>
        : <button type="button" className="admin-primary" onClick={() => void run()} disabled={!configured || !candidates?.length}><Play size={15}/>{t("Testi başlat")}</button>}
      {running && <span className="admin-trial-progress" role="status">{results.length} / {Math.min(count, candidates?.length || 0)}</span>}
    </div>
    {error && <div className="admin-notice error" role="alert">{t(error)}</div>}
    {candidates && !candidates.length && <div className="admin-card admin-empty">{t("Yayında ilan yok.")}</div>}

    {estimate && <div className="admin-card admin-trial-estimate">
      <h3><Calculator size={18}/>{t("Maliyet hesabı")}</h3>
      <dl>
        <div><dt>{t("Test edilen ilan")}</dt><dd>{results.length}</dd></div>
        <div><dt>{t("Çevrilen karakter")}</dt><dd>{number(estimate.outputChars)}</dd></div>
        <div><dt>{t("Token (girdi / çıktı / düşünme)")}</dt><dd>{number(estimate.tokens.input)} / {number(estimate.tokens.output)} / {number(estimate.tokens.thinking)}</dd></div>
        <div><dt>{t("Çıktı tokenı başına karakter")}</dt><dd>{estimate.charsPerOutputToken.toFixed(2)}</dd></div>
        <div><dt>{t("Bu testin maliyeti")}</dt><dd>{usd(estimate.cost, 4)}</dd></div>
      </dl>
      <p className="admin-trial-total">{t("{n} çevrilmiş karakter için").replace("{n}", number(TRIAL_VOLUME))}: <strong>{usd(estimate.standard, 0)}</strong> · {t("toplu modda (Batch, %{p} indirim)").replace("{p}", String(Math.round((1 - BATCH_FACTOR) * 100)))}: <strong>{usd(estimate.batch, 0)}</strong></p>
      {warnings > 0 && <p className="admin-trial-warn"><AlertTriangle size={15}/>{t("{n} uyarı var; aşağıda kırmızı işaretli çevirileri kontrol edin.").replace("{n}", String(warnings))}</p>}
    </div>}

    {results.map((item) => <article key={item.id} className="admin-card admin-trial-result">
      <button type="button" className="admin-trial-head" aria-expanded={open === item.id} onClick={() => setOpen(open === item.id ? null : item.id)}>
        <Languages size={17}/><strong>{item.title}</strong>
        <span>{item.source.toUpperCase()} → {trialTargets(item.source).length} · {number(item.outputChars)} {t("karakter")} · {usd(item.cost, 4)} · {(item.ms / 1000).toFixed(1)} sn{item.missing.length ? ` · ${t("eksik")}: ${item.missing.join(", ")}` : ""}{item.finish && item.finish !== "STOP" ? ` · ${item.finish}` : ""}</span>
      </button>
      {open === item.id && <div className="admin-trial-grid">
        <div className="admin-trial-cell source"><b>{item.source.toUpperCase()} · {t("Orijinal")}</b><h4 dir="auto">{item.title}</h4><p dir="auto">{item.description}</p></div>
        {trialTargets(item.source).map((code) => { const tr = item.translations[code]; return <div key={code} className={`admin-trial-cell${tr?.warnings.length || !tr ? " warn" : ""}`} lang={code} dir={RTL.has(code) ? "rtl" : "ltr"}>
          <b>{code.toUpperCase()}</b>{tr ? <><h4>{tr.title}</h4><p>{tr.description}</p>{tr.warnings.length > 0 && <small>{tr.warnings.join(" · ")}</small>}</> : <small>{t("Çeviri gelmedi")}</small>}
        </div>; })}
      </div>}
    </article>)}
  </section>;
}
