"use client";
import {PropertyPresentation} from "./PropertyPresentation";

import { useCallback, useEffect, useState } from "react";
import Link from "@/components/SafeLink";
import { ArrowLeft, Check, RotateCcw, ShieldCheck, X } from "lucide-react";
import { formatPrice, type Listing, typeLabel } from "@/lib/listings";
import { useLocale } from "@/lib/i18n";

type Owner = { name: string; email: string; role: string; company?: string | null };

export function AdminListingReview({ listingId }: { listingId: string }) {
  const { t } = useLocale();
  const [listing, setListing] = useState<Listing | null>(null);
  const [owner, setOwner] = useState<Owner | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin?listingId=${encodeURIComponent(listingId)}`, { cache: "no-store" });
      const result = await response.json() as { listing?: Listing; owner?: Owner; error?: string };
      if (!response.ok || !result.listing || !result.owner) throw new Error(result.error || "İlan yüklenemedi.");
      setListing(result.listing);
      setOwner(result.owner);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "İlan yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  useEffect(() => { load(); }, [load]);

  async function decide(status: "published" | "rejected" | "pending") {
    if (status === "rejected" && note.trim().length < 5) { setError("Ret nedenini en az 5 karakterle yazın."); return; }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/admin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "listing", id: listingId, status, note: note.trim() }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Karar kaydedilemedi.");
      setSuccess(status === "published" ? "İlan onaylandı ve yayına alındı." : status === "rejected" ? "İlan reddedildi. Gerekçe ilan sahibine gösterilecek." : "İlan yayından kaldırıldı ve incelemeye alındı.");
      setNote("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Karar kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className="admin-page"><div className="container section">{t("İlan incelemesi yükleniyor...")}</div></main>;
  if (!listing || !owner) return <main className="admin-page"><div className="container form-gate"><ShieldCheck size={36}/><h1>{t("İlan incelemesi açılamadı.")}</h1><p>{t(error)}</p><Link href="/yonetim" className="primary-button">{t("Yönetim paneline dön")}</Link></div></main>;

  return <main className="admin-page">
    <div className="form-hero"><div className="container"><Link href="/yonetim" className="admin-review-back"><ArrowLeft size={16}/> {t("Yönetim paneli")}</Link><span className="eyebrow dark-eyebrow">{t("ESTATEMARKET24 · İLAN İNCELEME")}</span><h1>{listing.title}</h1><p>{listing.neighborhood ? `${listing.neighborhood}, ` : ""}{listing.district}, {listing.city}</p></div></div>
    <div className="container admin-review-layout">
      <article className="admin-review-main">
        <div className="admin-review-photos">{listing.images.map((src, index) => <img key={src} src={src} alt={`${listing.title} ${t("fotoğraf {n}").replace("{n}", String(index + 1))}`} loading={index ? "lazy" : "eager"}/>)}</div>
        <div className="admin-review-section"><span className="eyebrow dark-eyebrow">{t("İLAN BİLGİLERİ")}</span><h2>{t("Gayrimenkul detayları")}</h2><div className="admin-review-facts">
          <div><span>{t("İlan türü")}</span><strong>{t(listing.purpose === "satilik" ? "Satılık" : "Kiralık")}</strong></div>
          <div><span>{t("Gayrimenkul tipi")}</span><strong>{t(typeLabel(listing.propertyType))}</strong></div>
          <div><span>{t("Fiyat")}</span><strong>{formatPrice(listing.price, listing.currency)}</strong></div>
          <div><span>{t("Konum")}</span><strong>{listing.neighborhood}{listing.postalCode ? ` (${listing.postalCode})` : ""}, {listing.district}, {listing.city}</strong></div>
          <div><span>{t("Brüt / net alan")}</span><strong>{listing.grossArea} m²{listing.netArea ? ` / ${listing.netArea} m²` : ""}</strong></div>
          {listing.rooms && <div><span>{t("Oda düzeni")}</span><strong>{listing.rooms}</strong></div>}
          {listing.bedrooms != null && <div><span>{t("Yatak odası")}</span><strong>{listing.bedrooms}</strong></div>}
          {listing.bathrooms != null && <div><span>{t("Banyo")}</span><strong>{listing.bathrooms}</strong></div>}
          {listing.buildingAge != null && <div><span>{t("Bina yaşı")}</span><strong>{listing.buildingAge}</strong></div>}
          {listing.floor != null && <div><span>{t("Bulunduğu kat")}</span><strong>{listing.floor}</strong></div>}
          {listing.totalFloors != null && <div><span>{t("Toplam kat")}</span><strong>{listing.totalFloors}</strong></div>}
          {listing.heating && <div><span>{t("Isıtma")}</span><strong>{listing.heating}</strong></div>}
          <div><span>{t("Eşyalı")}</span><strong>{t(listing.furnished ? "Evet" : "Hayır")}</strong></div>
        </div></div>
        <div className="admin-review-section"><span className="eyebrow dark-eyebrow">{t("AÇIKLAMA")}</span><PropertyPresentation value={listing.presentation}/><p className="admin-review-description">{listing.description}</p></div>
        <div className="admin-review-section"><span className="eyebrow dark-eyebrow">{t("ÖZELLİKLER")}</span><p>{listing.amenities.length ? listing.amenities.map((amenity) => t(amenity)).join(" · ") : t("Belirtilmemiş")}</p></div>
        {listing.translations && Object.entries(listing.translations).length > 0 && <div className="admin-review-section"><span className="eyebrow dark-eyebrow">{t("ÇEVİRİLER")}</span>{Object.entries(listing.translations).map(([locale, translation]) => <div className="admin-review-translation" key={locale}><strong>{locale.toUpperCase()} · {translation?.title}</strong><p>{translation?.description}</p></div>)}</div>}
      </article>
      <aside className="admin-review-aside">
        <div className="admin-review-card"><span className={`admin-review-status ${listing.status || "pending"}`}>{t(listing.status === "published" ? "Yayında" : listing.status === "rejected" ? "Reddedildi" : "Onay bekliyor")}</span><h2>{t("Yayın kararı")}</h2><p>{t("Bireysel ilanlar yönetici onayıyla yayımlanır. Onaylı emlakçıların ilanları doğrudan yayımlanabilir; yönetim gerektiğinde ilanı yayından kaldırabilir.")}</p><div className="admin-review-owner"><span>{t("İlanı gönderen")}</span><strong>{owner.name}</strong><small>{owner.company || owner.email}</small><small>{t(owner.role === "agent" ? "Emlakçı" : "Bireysel mal sahibi")}</small></div><label htmlFor="review-note">{t("Karar notu")} {listing.status !== "published" && <small>{t("(ret için zorunlu)")}</small>}<textarea id="review-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} rows={4} placeholder={t("İlan sahibine gösterilecek açıklama")}/></label>
          <div className="admin-review-actions">{listing.status !== "published" && <button className="approve" type="button" onClick={() => decide("published")} disabled={busy}><Check size={17}/> {t("Onayla ve yayınla")}</button>}{listing.status !== "rejected" && <button className="reject" type="button" onClick={() => decide("rejected")} disabled={busy}><X size={17}/> {t("Reddet")}</button>}{listing.status !== "pending" && <button type="button" onClick={() => decide("pending")} disabled={busy}><RotateCcw size={16}/> {t("İncelemeye geri al")}</button>}</div>
          {listing.reviewNote && <p className="admin-review-previous"><strong>{t("Son karar notu:")}</strong> {listing.reviewNote}</p>}{success && <p className="form-status" role="status">{t(success)}</p>}{error && <p className="form-error" role="alert">{t(error)}</p>}
        </div>
      </aside>
    </div>
  </main>;
}
