"use client";
import { useEffect, useState } from "react";
import Link from "@/components/SafeLink";
import { ArrowDownRight, ArrowUpRight, Eye, Heart, Lightbulb, MessageCircle, Phone, TrendingUp } from "lucide-react";
import { apiJson } from "@/lib/api-client";
import { useLocale } from "@/lib/i18n";
import type { CrmStats as Stats, Insight } from "@/lib/crm-stats";

// CRM › İstatistikler (lib/crm-stats.ts): funnel, trend against the previous period, visitor languages and
// advice per listing, weakest listings first.
const LANGUAGE_NAMES: Record<string, string> = { tr: "Türkçe", de: "Almanca", fr: "Fransızca", en: "İngilizce", ar: "Arapça", fa: "Farsça", ru: "Rusça", nl: "Felemenkçe" };
const ADVICE: Record<string, string> = {
  not_published: "İlan yayında değil; istatistik toplanmıyor.",
  low_views: "Benzer ilanlar ortalama {n} kez görüntülendi. Kapak fotoğrafını ve başlığı güçlendirin.",
  views_no_contact: "{n} görüntülenme var ama kimse iletişime geçmedi. Fiyatı ve açıklamayı gözden geçirin.",
  low_conversion: "Görüntüleyenlerin yalnızca %{n}'i iletişime geçti. Fiyat veya açıklama ilgiyi karşılamıyor olabilir.",
  favorites_no_contact: "{n} kişi favorilere ekledi ama yazmadı. Fiyatı veya açıklamayı güncellemek ilgilerini yeniden çekebilir.",
  stale: "İlan {n} gündür yayında ve son 7 günde görüntülenmedi. Yenileyin veya öne çıkarın.",
  few_photos: "Yalnızca {n} fotoğraf var. En az 6–8 fotoğraf ilgiyi belirgin artırır.",
  short_description: "Açıklama kısa. Konum, oda düzeni, aidat ve tapu bilgisi ekleyin.",
  foreign_interest: "Ziyaretçilerin %{n}'i yabancı dilde geliyor. İlanınız yurt dışından ilgi görüyor.",
  top_views: "Benzer ilanlardan {n} kat fazla görüntüleniyor.",
  strong_conversion: "Görüntüleyenlerin %{n}'i iletişime geçti; çok iyi bir oran.",
};

function Trend({ now, before }: { now: number; before: number }) {
  const { t } = useLocale();
  if (!before && !now) return null;
  if (!before) return <small className="crm-trend up"><ArrowUpRight size={13}/>{t("yeni")}</small>;
  const change = Math.round((now - before) / before * 100);
  return <small className={`crm-trend ${change >= 0 ? "up" : "down"}`}>{change >= 0 ? <ArrowUpRight size={13}/> : <ArrowDownRight size={13}/>}%{Math.abs(change)}</small>;
}

export function CrmStats() {
  const { t, locale } = useLocale();
  const [days, setDays] = useState(30), [stats, setStats] = useState<Stats | null>(null), [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    fetch(`/api/crm/stats?days=${days}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => { const data = await apiJson<Stats & { error?: string }>(response); if (!response.ok) throw new Error(data.error || "İstatistikler yüklenemedi."); setStats(data); })
      .catch((cause) => { if (!controller.signal.aborted) setError((cause as Error).message); });
    return () => controller.abort();
  }, [days]);
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const advice = (item: Insight) => t(ADVICE[item.code] || item.code).replace("{n}", item.value === undefined ? "" : number(item.value));
  if (error) return <div className="form-error" role="alert">{t(error)}</div>;
  if (!stats) return <div className="panel-empty">{t("Yükleniyor...")}</div>;
  if (!stats.listings.length) return <div className="panel-empty"><TrendingUp size={28}/><h3>{t("Henüz istatistik yok.")}</h3><Link href="/ilan-ver">{t("İlk ilanınızı oluşturun")}</Link></div>;
  const { totals, previous } = stats, peak = Math.max(1, ...stats.series.map((day) => day.views));
  const funnel = [
    { label: "Görüntülenme", value: totals.views, icon: Eye },
    { label: "Favori", value: totals.favorites, icon: Heart },
    { label: "İletişim", value: totals.contacts, icon: MessageCircle },
    { label: "Randevu", value: totals.appointments, icon: Phone },
  ];
  const languageTotal = Object.values(stats.languages).reduce((sum, value) => sum + value, 0);
  return <section className="crm-stats">
    <div className="crm-toolbar" role="group" aria-label={t("Dönem")}>
      {[7, 30, 90].map((value) => <button key={value} type="button" aria-pressed={days === value} onClick={() => setDays(value)}>{t("Son {n} gün").replace("{n}", String(value))}</button>)}
    </div>
    {stats.unanswered > 0 && <Link className="crm-alert" href="/hesabim?tab=mesajlar">{t("{n} müşteri 24 saattir yanıt bekliyor.").replace("{n}", number(stats.unanswered))} <ArrowUpRight size={15}/></Link>}
    <div className="crm-kpis">
      {[
        { label: "Görüntülenme", now: totals.views, before: previous.views },
        { label: "Favoriye ekleme", now: totals.favorites, before: previous.favorites },
        { label: "Telefon / WhatsApp", now: totals.phone + totals.whatsapp, before: previous.phone + previous.whatsapp },
        { label: "Mesaj atan kişi", now: totals.messages, before: previous.messages },
        { label: "Randevu talebi", now: totals.appointments, before: previous.appointments },
      ].map((card) => <div key={card.label}><span>{t(card.label)}</span><strong>{number(card.now)}</strong><Trend now={card.now} before={card.before}/></div>)}
      <div><span>{t("Dönüşüm oranı")}</span><strong>%{totals.conversion}</strong><small className="crm-note">{t("iletişim / görüntülenme")}</small></div>
    </div>
    <div className="crm-grid">
      <figure className="crm-card">
        <figcaption>{t("Günlük görüntülenme ve iletişim")}</figcaption>
        <div className="crm-bars" role="img" aria-label={t("Günlük görüntülenme ve iletişim")}>{stats.series.map((day) => <span key={day.day} title={`${day.day}: ${number(day.views)} ${t("görüntülenme")} · ${number(day.contacts)} ${t("iletişim")}`}><i style={{ height: `${day.views / peak * 100}%` }}/>{day.contacts > 0 && <b style={{ height: `${Math.max(6, day.contacts / peak * 100)}%` }}/>}</span>)}</div>
        <p className="crm-legend"><span className="views"/>{t("Görüntülenme")} <span className="contacts"/>{t("İletişim")}</p>
      </figure>
      <div className="crm-card">
        <h3>{t("Satış hunisi")}</h3>
        <ol className="crm-funnel">{funnel.map((step, index) => <li key={step.label} style={{ width: `${Math.max(28, step.value / Math.max(1, funnel[0].value) * 100)}%` }}><step.icon size={15}/><span>{t(step.label)}</span><strong>{number(step.value)}</strong>{index > 0 && funnel[index - 1].value > 0 && <small>%{Math.round(step.value / funnel[index - 1].value * 100)}</small>}</li>)}</ol>
      </div>
      <div className="crm-card">
        <h3>{t("Ziyaretçi dilleri")}</h3>
        {languageTotal ? <ul className="crm-languages">{Object.entries(stats.languages).sort((a, b) => b[1] - a[1]).map(([code, value]) => <li key={code}><span>{t(LANGUAGE_NAMES[code] || code)}</span><i><b style={{ width: `${value / languageTotal * 100}%` }}/></i><strong>%{Math.round(value / languageTotal * 100)}</strong></li>)}</ul>
          : <p className="crm-note">{t("Dil bilgisi yeni toplanmaya başladı; birkaç gün içinde burada görünür.")}</p>}
      </div>
    </div>
    <h3 className="crm-section-title">{t("İlanlarınız")} <small>{t("En çok ilgi isteyenler üstte")}</small></h3>
    <div className="crm-listings">{stats.listings.map((listing) => <article key={listing.id} className="crm-listing">
      <Link href={`/ilan/${listing.id}`} className="crm-listing-head">{listing.photo ? <img src={listing.photo} alt="" loading="lazy"/> : <span className="crm-photo-empty"/>}<div><strong>{listing.title}</strong><small>{listing.city}</small></div></Link>
      <div className={`crm-score ${listing.score >= 80 ? "good" : listing.score >= 55 ? "fair" : "poor"}`} title={t("İlan sağlığı")}><strong>{listing.score}</strong><small>/100</small></div>
      <dl className="crm-listing-metrics">
        <div><dt>{t("Görüntülenme")}</dt><dd>{number(listing.views)}{listing.benchmark > 0 && <small> · {t("benzer ort.")} {number(listing.benchmark)}</small>}</dd></div>
        <div><dt>{t("Favori")}</dt><dd>{number(listing.favorites)}</dd></div>
        <div><dt>{t("Telefon")}</dt><dd>{number(listing.phone)}</dd></div>
        <div><dt>WhatsApp</dt><dd>{number(listing.whatsapp)}</dd></div>
        <div><dt>{t("Mesaj")}</dt><dd>{number(listing.messages)}</dd></div>
        <div><dt>{t("Dönüşüm")}</dt><dd>%{listing.conversion}</dd></div>
      </dl>
      {listing.insights.length > 0 && <ul className="crm-insights">{listing.insights.map((item) => <li key={item.code} className={item.tone}><Lightbulb size={14} aria-hidden="true"/>{advice(item)}</li>)}</ul>}
    </article>)}</div>
    <p className="crm-note">{t("Görüntülenmeler kişi başına günde bir kez sayılır; çerezlere izin vermeyen ziyaretçiler sayılmaz. Benzer ilanlar: aynı şehir ve emlak tipindeki yayındaki ilanlar.")}</p>
  </section>;
}
