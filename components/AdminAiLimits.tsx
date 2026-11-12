"use client";
import { useCallback, useEffect, useState } from "react";
import { Gauge, RotateCcw, Save } from "lucide-react";
import { apiJson } from "@/lib/api-client";
import { useLocale } from "@/lib/i18n";
import type { AiHistoryDay, AiLimitRow } from "@/lib/ai-limits";

type Limit = AiLimitRow & { used: number; percent: number; capCost: number };
type Report = { agents: number; configured: boolean; cost: { day: number; month: number }; tokens: { monthInput: number; monthOutput: number }; history: AiHistoryDay[]; limits: Limit[] };
const SOURCES: Record<Limit["source"], string> = { panel: "Panelden", env: "Ortam değişkeni", default: "Varsayılan" };

function LimitCard({ limit, agents, onSaved }: { limit: Limit; agents: number; onSaved: () => void }) {
  const { t, locale } = useLocale();
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const usd = (value: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: value < 10 ? 2 : 0 }).format(value);
  const [base, setBase] = useState(limit.base === null ? "" : String(limit.base)), [perAgent, setPerAgent] = useState(String(limit.perAgent));
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function save(reset = false) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/ai-limits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: limit.id, base: reset ? null : base.replace(/\D/g, "") || null, perAgent: reset ? 0 : perAgent.replace(/\D/g, "") || 0 }) });
      const data = await apiJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(data.error || "Kota kaydedilemedi.");
      onSaved();
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  const level = limit.percent >= 100 ? "exceeded" : limit.percent >= 80 ? "warning" : "normal";
  return <article className={`admin-card admin-ai-limit level-${level}`}>
    <header><h3>{t(limit.label)}</h3><span className="admin-badge neutral">{t(SOURCES[limit.source])}</span></header>
    <p className="admin-ai-used"><strong>{number(limit.used)}</strong> / {number(limit.effective)} <small>{t(limit.period === "day" ? "bugün" : "bu ay")} · %{limit.percent}</small></p>
    <div className="admin-ai-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, limit.percent)} aria-label={t(limit.label)}><i style={{ width: `${Math.min(100, limit.percent)}%` }}/></div>
    <p className="admin-ai-note">{t("Tamamen kullanılırsa yaklaşık {usd}").replace("{usd}", usd(limit.capCost))}{limit.perAgent > 0 ? ` · ${t("{n} onaylı emlakçı ile büyüdü").replace("{n}", number(agents))}` : ""}</p>
    <div className="admin-ai-form">
      <label>{t("Temel sınır")}<input inputMode="numeric" value={base} placeholder={number(limit.env ?? limit.fallback)} onChange={(event) => setBase(event.target.value)}/></label>
      <label>{t("Onaylı emlakçı başına ek")}<input inputMode="numeric" value={perAgent} onChange={(event) => setPerAgent(event.target.value)}/></label>
      <button type="button" className="admin-primary" disabled={busy} onClick={() => void save()}><Save size={14}/>{t("Kaydet")}</button>
      {limit.source === "panel" && <button type="button" className="admin-secondary" disabled={busy} onClick={() => void save(true)}><RotateCcw size={14}/>{t("Varsayılana dön")}</button>}
    </div>
    {error && <p className="form-error" role="alert">{t(error)}</p>}
  </article>;
}

// Admin view "Yapay zekâ kotaları" (lib/ai-limits.ts): caps without a restart, usage and estimated cost.
export function AdminAiLimits() {
  const { t, locale } = useLocale();
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const usd = (value: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
  const [report, setReport] = useState<Report | null>(null), [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/ai-limits", { cache: "no-store" });
      const data = await apiJson<Report & { error?: string }>(response);
      if (!response.ok) throw new Error(data.error || "Kotalar yüklenemedi.");
      setReport(data); setError("");
    } catch (cause) { setError((cause as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const peak = report ? Math.max(0.01, ...report.history.map((day) => day.cost)) : 1;
  return <section className="admin-ai-limits">
    <div className="admin-section-title"><div><h2>{t("Yapay zekâ kotaları")}</h2><p>{t("Asistan, doğal dil araması ve çeviri için site geneli günlük ve aylık sınırlar. Değişiklikler bir dakika içinde, yeniden başlatmadan geçerli olur. Sınır dolunca özellik dönem sonuna kadar duraklar; çeviride asıl metin gösterilir.")}</p></div></div>
    {error && <div className="admin-notice error" role="alert">{t(error)}</div>}
    {!report && !error && <div className="admin-card admin-loading">{t("Yükleniyor...")}</div>}
    {report && <>
      {!report.configured && <div className="admin-notice error" role="alert">{t("GEMINI_API_KEY ayarlı değil.")}</div>}
      <div className="admin-card admin-ai-summary">
        <div><span>{t("Bugünkü tahmini maliyet")}</span><strong>{usd(report.cost.day)}</strong></div>
        <div><span>{t("Bu ayki tahmini maliyet")}</span><strong>{usd(report.cost.month)}</strong></div>
        <div><span>{t("Bu ay Gemini token (girdi / çıktı)")}</span><strong>{number(report.tokens.monthInput)} / {number(report.tokens.monthOutput)}</strong></div>
        <div><span>{t("Onaylı emlakçı")}</span><strong>{number(report.agents)}</strong></div>
      </div>
      <figure className="admin-card admin-ai-chart">
        <figcaption><Gauge size={16}/>{t("Son 30 günün tahmini maliyeti")}</figcaption>
        <div className="admin-ai-bars" role="img" aria-label={t("Son 30 günün tahmini maliyeti")}>{report.history.map((day) => <span key={day.day} title={`${day.day}: ${usd(day.cost)} · ${number(day.assistantCalls)} / ${number(day.searchCalls)} / ${number(day.translationChars)}`}><i style={{ height: `${(day.cost / peak) * 100}%` }}/></span>)}</div>
        <p className="admin-ai-note">{t("Tahmindir: Gemini 3.5 Flash-Lite liste fiyatları ve ölçülen çeviri maliyeti. Gerçek fatura Google Cloud Console › Faturalandırma'dadır.")}</p>
      </figure>
      <div className="admin-ai-grid">{report.limits.map((limit) => <LimitCard key={`${limit.id}:${limit.base}:${limit.perAgent}`} limit={limit} agents={report.agents} onSaved={() => void load()}/>)}</div>
    </>}
  </section>;
}
