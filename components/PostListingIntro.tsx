"use client";
import Link from "@/components/SafeLink";
import { ArrowRight, BarChart3, Building2, Camera, Globe2, Home, Languages, MessagesSquare } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { INDIVIDUAL_PUBLICATION_DAYS, INDIVIDUAL_SUBMISSION_DAYS } from "@/lib/listing-policy";

// /ilan-ver for visitors who are not signed in: what publishing here gives them and how it works, instead of a
// bare "sign in" box. Only states what the site really does (free, rules in lib/listing-policy.ts, translation
// into the site languages, translated messages, owner statistics).
const SIGN_IN = "/giris?next=/ilan-ver";
export function PostListingIntro() {
  const { t } = useLocale();
  const days = (text: string) => t(text).replace("{publish}", String(INDIVIDUAL_PUBLICATION_DAYS)).replace("{every}", String(INDIVIDUAL_SUBMISSION_DAYS));
  const steps = [
    ["Ücretsiz hesap oluşturun", "E-posta adresinizle veya Google hesabınızla birkaç dakikada üye olun."],
    ["Bilgileri ve fotoğrafları ekleyin", "Fiyat, konum, oda sayısı ve en fazla 30 fotoğraf. Yazdıklarınız taslak olarak kendiliğinden kaydedilir."],
    ["Yayınlayın", "İlanınız 8 dilde Türkiye'deki ve yurt dışındaki alıcılara ulaşır."],
  ];
  const benefits = [
    { Icon: Languages, title: "Kendi dilinizde yazın", text: "İlanı Türkçe, Almanca veya sitenin başka bir dilinde yazın; diğer dillere otomatik çevrilir." },
    { Icon: MessagesSquare, title: "Mesajlar sizin dilinizde", text: "Alıcıların mesajlarını kendi dilinizde okur, kendi dilinizde yanıtlarsınız." },
    { Icon: Camera, title: "Güçlü sunum", text: "Fotoğraf galerisi, 360° tur ve kat planıyla mülkünüzü yakından tanıtın." },
    { Icon: BarChart3, title: "İlgiyi ölçün", text: "İlanınızın kaç kez görüntülendiğini ve kaç kişinin iletişime geçtiğini Hesabım'dan izleyin." },
  ];
  return <main className="post-intro">
    <section className="post-intro-hero"><div className="container">
      <span className="eyebrow">{t("İLAN VER")}</span>
      <h1>{t("Mülkünüzü ücretsiz ilan edin.")}</h1>
      <p>{t("Satılık veya kiralık evinizi, arsanızı ya da iş yerinizi Türkiye'deki ve yurt dışındaki alıcılara gösterin.")}</p>
      <div className="post-intro-actions"><Link className="primary-button" href={SIGN_IN}>{t("Giriş Yap / Üye Ol")}<ArrowRight size={18}/></Link><Link className="text-link" href="/ilan-kurallari">{t("İlan kuralları")}</Link></div>
    </div></section>
    <section className="container post-intro-steps" aria-label={t("Nasıl çalışır")}>
      <ol>{steps.map(([title, text]) => <li key={title}><h2>{t(title)}</h2><p>{t(text)}</p></li>)}</ol>
    </section>
    <section className="container post-intro-benefits">
      {benefits.map(({ Icon, title, text }) => <article key={title}><Icon size={24} aria-hidden="true"/><h3>{t(title)}</h3><p>{t(text)}</p></article>)}
    </section>
    <section className="container post-intro-who">
      <h2>{t("Kimler ilan verebilir?")}</h2>
      <div>
        <article><Home size={24} aria-hidden="true"/><h3>{t("Mal sahipleri")}</h3><p>{days("Bireysel üyeler {every} günde bir ilan verebilir; ilan {publish} gün yayında kalır.")}</p></article>
        <article><Building2 size={24} aria-hidden="true"/><h3>{t("Emlak ofisleri")}</h3><p>{t("Taşınmaz Ticareti Yetki Belgesi onaylandıktan sonra paket almadan ilan yayımlayabilirsiniz.")}</p></article>
        <article><Globe2 size={24} aria-hidden="true"/><h3>{t("Yurt dışında yaşayanlar")}</h3><p>{t("Türkiye'deki mülkünüzü bulunduğunuz ülkeden, kendi dilinizde ilan edin.")}</p><Link className="text-link" href="/yurtdisindan-ilan">{t("Ayrıntılar")}<ArrowRight size={16}/></Link></article>
      </div>
      <Link className="primary-button" href={SIGN_IN}>{t("Hemen başlayın")}<ArrowRight size={18}/></Link>
    </section>
  </main>;
}
