"use client";
import Link from "@/components/SafeLink";
import { ArrowRight, BadgeCheck, Clock, EyeOff, MessageSquareQuote, Sparkles, Users } from "lucide-react";
import { useLocale } from "@/lib/i18n";

// Home page: "Benim için bul" as the premium service, right under the quick links (owner's request 2026-11-24).
// Buyers describe the home they want; up to four estate agents answer with offers (lib/home-requests.ts,
// lib/lead-board.ts). The preview on the right is an illustration and is labelled as an example.
export function HomeFindForMe() {
  const { t } = useLocale();
  const steps = [
    { title: "Aradığınızı anlatın", text: "Şehir, bütçe, oda sayısı ve ne zaman taşınacağınız. 2 dakika sürer." },
    { title: "Danışmanlar teklif gönderir", text: "Bölgeyi bilen en fazla 4 danışman, size uyan ilanlarla döner." },
    { title: "Siz seçin", text: "Teklifleri Hesabım'da karşılaştırın; dilediğinizle görüşün." },
  ];
  return <section className="ffm container" aria-labelledby="ffm-title">
    <div className="ffm-copy">
      <span className="ffm-kicker"><Sparkles size={14} aria-hidden="true"/>{t("PREMIUM HİZMET · BENİM İÇİN BUL")}</span>
      <h2 id="ffm-title">{t("Aradığınız evi anlatın, uzmanlar size gelsin")}</h2>
      <p>{t("İlan ilan gezmek yerine ne istediğinizi bir kez yazın. Bölgesinde uzman danışmanlar size uygun evlerle teklif gönderir; aramayı onlar yapar, kararı siz verirsiniz.")}</p>
      <ol className="ffm-steps">{steps.map((step, index) => <li key={step.title}><span>{index + 1}</span><div><strong>{t(step.title)}</strong><small>{t(step.text)}</small></div></li>)}</ol>
      <ul className="ffm-trust">
        <li><EyeOff size={15} aria-hidden="true"/>{t("Numaranız siz izin verene kadar gizli")}</li>
        <li><Users size={15} aria-hidden="true"/>{t("En fazla 4 seçkin danışman")}</li>
        <li><Clock size={15} aria-hidden="true"/>{t("Ücretsiz, 2 dakikada")}</li>
      </ul>
      <div className="ffm-cta">
        <Link href="/benim-icin-bul" className="ffm-primary">{t("Talebimi oluştur")}<ArrowRight size={18} aria-hidden="true"/></Link>
        <Link href="/paketler" className="ffm-secondary">{t("Emlakçı mısınız? Talep bültenine katılın")}</Link>
      </div>
    </div>
    <div className="ffm-visual" aria-hidden="true">
      <span className="ffm-example">{t("Örnek görünüm")}</span>
      <div className="ffm-request">
        <span className="ffm-chip">{t("Satın almak istiyor")}</span>
        <strong>{t("3+1 daire · Karşıyaka, İzmir")}</strong>
        <small>{t("6–9 milyon TL · 3 ay içinde · denize yakın")}</small>
      </div>
      <div className="ffm-offer one"><BadgeCheck size={18}/><div><strong>{t("Ege Emlak · Ayşe K.")}</strong><small><MessageSquareQuote size={13}/>{t("“Sahile 5 dakika, tam bütçenizde 2 daire var.”")}</small></div><b>{t("2 ilan")}</b></div>
      <div className="ffm-offer two"><BadgeCheck size={18}/><div><strong>{t("Körfez Gayrimenkul · Can D.")}</strong><small><MessageSquareQuote size={13}/>{t("“Cumartesi gösterebilirim.”")}</small></div><b>{t("1 ilan")}</b></div>
    </div>
  </section>;
}
