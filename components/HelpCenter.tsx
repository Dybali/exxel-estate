"use client";
import { useEffect, useState } from "react";
import Link from "@/components/SafeLink";
import { ArrowRight, Building2, CircleHelp, Hammer, Home, KeyRound, LifeBuoy, Mail, Search } from "lucide-react";
import { useLocale } from "@/lib/i18n";

// /yardim: step-by-step guides per kind of visitor (owner's request 2026-11-23: the site should explain itself).
// Each step links to the page where it is done. The detailed questions stay on /sss.
type Guide = { id: string; label: string; icon: typeof Home; intro: string; steps: { title: string; text: string; href: string; cta: string }[] };
export const HELP_GUIDES: Guide[] = [
  { id: "alici", label: "Ev arayanlar", icon: Search, intro: "Satın almak veya kiralamak için ev arıyorsanız bu adımlarla başlayın.", steps: [
    { title: "İlanları arayın", text: "İl, ilçe, fiyat, oda sayısı ve özelliklere göre filtreleyin; sonuçları liste, kart veya harita olarak görün. Aradığınızı kendi cümlelerinizle de yazabilirsiniz.", href: "/ilanlar", cta: "İlanları keşfet" },
    { title: "Favorileyin ve aramanızı kaydedin", text: "Beğendiğiniz ilanda kalp simgesine dokunun; fiyatı düşerse haber verelim. Aramayı kaydederseniz uyan yeni ilanlar e-postanıza gelir.", href: "/hesabim?tab=favoriler", cta: "Favorilerim" },
    { title: "Benim için bul", text: "Aradığınız evi dört kısa adımda anlatın; onaylı danışmanlar size teklif ve ilan önerisiyle dönsün.", href: "/benim-icin-bul", cta: "Talep bırak" },
    { title: "Fiyatı doğru değerlendirin", text: "Emlak piyasası haritasında il il m² fiyatlarını, konut değerlemede bölgedeki benzer ilanları, hesaplama araçlarında tapu masrafını görün.", href: "/emlak-piyasasi", cta: "Emlak piyasası" },
    { title: "İlan sahibine yazın", text: "İlan sayfasındaki mesaj alanından yazın; mesajlar kendi dilinize çevrilir. Yazışmalarınız Hesabım › Mesajlar bölümünde durur.", href: "/hesabim?tab=mesajlar", cta: "Mesajlarım" },
  ] },
  { id: "ev-sahibi", label: "Ev sahipleri", icon: KeyRound, intro: "Evinizi, arsanızı veya iş yerinizi satmak ya da kiraya vermek için.", steps: [
    { title: "Ücretsiz üye olun", text: "E-postanızla veya Google hesabınızla birkaç saniyede üye olun; e-postanızı doğrulayınca ilan verebilirsiniz.", href: "/giris?mode=register", cta: "Üye ol" },
    { title: "Fiyatınızı belirleyin", text: "Konut değerleme aracı bölgenizdeki benzer ilanlara bakarak bir fiyat aralığı ve kira getirisi gösterir.", href: "/konut-degerleme", cta: "Konut değerleme" },
    { title: "İlanınızı verin", text: "Bilgileri girin, fotoğrafları yükleyin; ilanınız 10 dile çevrilir ve yurt dışındaki alıcılara da ulaşır. Yurt dışında yaşıyorsanız kendi dilinizde yazabilirsiniz.", href: "/ilan-ver", cta: "İlan ver" },
    { title: "Mesajları yanıtlayın", text: "Alıcıların mesajları Hesabım › Mesajlar bölümüne gelir ve sizin dilinize çevrilir; yanıtınız da onların diline çevrilir.", href: "/hesabim?tab=mesajlar", cta: "Mesajlarım" },
  ] },
  { id: "emlakci", label: "Emlakçılar", icon: Building2, intro: "Emlak ofisleri ve danışmanlar için: portföyünüzü yayınlayın, yeni müşterilere ulaşın.", steps: [
    { title: "Emlakçı hesabı açın ve yetki belgenizi yükleyin", text: "Belgeniz onaylanınca ilanlarınızda Doğrulanmış Emlakçı rozeti görünür ve Talep akışı açılır.", href: "/hesabim?tab=firma", cta: "Ofis bilgilerim" },
    { title: "İlanlarınızı yükleyin", text: "Tek tek ilan verin ya da portföyünüzü XML dosyasıyla tek seferde aktarın. Hizmet bedelini ilanda belirtebilirsiniz.", href: "/toplu-ilan", cta: "Toplu ilan yükleme" },
    { title: "Talep akışından müşteri bulun", text: "Ev arayan üyelerin talepleri Hesabım › Talep akışı bölümünde; beğendiğinize teklif gönderin. Bir talebe en fazla 4 danışman ulaşabilir.", href: "/hesabim?tab=talep-akisi", cta: "Talep akışı" },
    { title: "Ekibinizi ve dillerinizi ekleyin", text: "Danışmanlarınızı ofisinize davet edin, konuştuğunuz dilleri seçin; yabancı alıcılar sizi Danışmanlar sayfasında dil filtresiyle bulur.", href: "/hesabim?tab=ekip", cta: "Ekibim" },
    { title: "İlanınızı öne çıkarın", text: "Öne çıkan ilanlar aramalarda üstte ve vurgulu görünür; paketlerle daha çok ilan yayınlayın.", href: "/paketler", cta: "Paketler" },
  ] },
  { id: "firma", label: "Hizmet firmaları ve müteahhitler", icon: Hammer, intro: "Tadilat, nakliyat, hukuk gibi hizmet firmaları ve inşaat firmaları için.", steps: [
    { title: "Firmanızı ekleyin", text: "Hizmet firması veya müteahhit hesabı açın; firma bilgilerinizi, kategorilerinizi ve iletişim bilgilerinizi girin.", href: "/hizmetler", cta: "Hizmetler" },
    { title: "Bölgelerinizi ve belgelerinizi ekleyin", text: "Çalıştığınız il ve ilçeleri seçin, belgelerinizi yükleyin; müteahhitler tamamlanan projelerini fotoğraflarıyla ekler.", href: "/hesabim", cta: "Firma panelim" },
    { title: "Talepleri yanıtlayın", text: "Teklif talepleri ve kat karşılığı talepleri firma panelinize gelir; fiyat teklifinizi oradan gönderin.", href: "/hesabim", cta: "Firma panelim" },
    { title: "Paketinizi seçin", text: "Ücretsiz paketle başlayın; Plus ve Pro ile daha çok fotoğraf, öne çıkma ve müşteriyle canlı çeviriyle mesajlaşma.", href: "/hizmetler/paketler", cta: "Paketler" },
  ] },
];

export function HelpCenter() {
  const { t } = useLocale();
  const [active, setActive] = useState(HELP_GUIDES[0].id);
  useEffect(() => { const hash = window.location.hash.slice(1); if (HELP_GUIDES.some((guide) => guide.id === hash)) setActive(hash); }, []);
  const guide = HELP_GUIDES.find((item) => item.id === active) || HELP_GUIDES[0];
  const choose = (id: string) => { setActive(id); history.replaceState(null, "", `#${id}`); };
  return <main className="tools-page help-page">
    <section className="tools-hero"><div className="container">
      <span className="market-overline"><LifeBuoy size={15} aria-hidden="true"/> {t("YARDIM MERKEZİ")}</span>
      <h1>{t("Siteyi nasıl kullanırım?")}</h1>
      <p>{t("Size uyan rehberi seçin; her adımın yanındaki düğme sizi o işin yapıldığı sayfaya götürür.")}</p>
    </div></section>
    <div className="container help-body">
      <div className="help-tabs" role="tablist" aria-label={t("Rehberler")}>{HELP_GUIDES.map((item) => { const Icon = item.icon; return <button key={item.id} type="button" role="tab" aria-selected={item.id === active} className={item.id === active ? "active" : ""} onClick={() => choose(item.id)}><Icon size={18} aria-hidden="true"/>{t(item.label)}</button>; })}</div>
      <section className="help-guide" role="tabpanel" aria-label={t(guide.label)}>
        <p className="help-intro">{t(guide.intro)}</p>
        <ol className="help-steps">{guide.steps.map((step, index) => <li key={step.title}>
          <span className="help-step-no">{index + 1}</span>
          <div><h2>{t(step.title)}</h2><p>{t(step.text)}</p></div>
          <Link className="outline-button" href={step.href}>{t(step.cta)}<ArrowRight size={15} aria-hidden="true"/></Link>
        </li>)}</ol>
      </section>
      <section className="help-more">
        <Link href="/sss"><CircleHelp size={22} aria-hidden="true"/><span><strong>{t("Sık sorulan sorular")}</strong><small>{t("Arama, ilan verme, hesap ve güvenlik hakkında ayrıntılı cevaplar.")}</small></span><ArrowRight size={18} aria-hidden="true"/></Link>
        <Link href="/iletisim"><Mail size={22} aria-hidden="true"/><span><strong>{t("Bize yazın")}</strong><small>{t("Cevabını bulamadığınız sorular için iletişim formu.")}</small></span><ArrowRight size={18} aria-hidden="true"/></Link>
      </section>
    </div>
  </main>;
}
