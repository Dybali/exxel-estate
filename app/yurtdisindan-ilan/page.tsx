import { ArrowRight, BadgeEuro, Languages, MessagesSquare, Wrench } from "lucide-react";
import Link from "@/components/SafeLink";
import { T } from "@/lib/i18n";

// Landing page for owners who live abroad (e.g. in Germany) and want to advertise a property in
// Türkiye. Title and description come from lib/seo-copy.ts ("/yurtdisindan-ilan").
const BENEFITS = [
  { icon: Languages, title: "Kendi dilinizde yazın", text: "Başlığı ve açıklamayı Almanca, İngilizce, Türkçe veya sitenin diğer dillerinden birinde yazın; ilan diğer dillere otomatik çevrilir." },
  { icon: BadgeEuro, title: "Fiyatı euro ile hesaplayın", text: "Tutarı euro, dolar veya sterlin olarak yazın; TL fiyatı güncel TCMB kuruyla hesaplanır. Ziyaretçiler fiyatı kendi para birimlerinde görür." },
  { icon: MessagesSquare, title: "Alıcılarla kendi dilinizde yazışın", text: "Mesajlar site üzerinden gelir ve otomatik çevrilir; yurt dışı telefon numaranızı da ekleyebilirsiniz." },
  { icon: Wrench, title: "Türkiye'de yerinde destek bulun", text: "Tapu takibi, ekspertiz, tadilat ve anahtar teslimi için Hizmetler bölümündeki firmalara ulaşın." },
] as const;
const STEPS = [
  { title: "Ücretsiz üye olun", text: "E-posta adresinizle kaydolun ve gelen kodla doğrulayın." },
  { title: "İlanınızı oluşturun", text: "İl, ilçe ve mahalleyi seçin; fotoğrafları, özellikleri ve fiyatı ekleyin." },
  { title: "Talepleri yanıtlayın", text: "Mesajlar ve randevu talepleri hesabınıza gelir; e-posta ile de haber veririz." },
] as const;

export default function OwnersAbroadPage() {
  return <main className="abroad-page">
    <header className="abroad-hero"><div className="container">
      <span className="market-overline"><T id="YURT DIŞINDA YAŞAYAN MÜLK SAHİPLERİ"/></span>
      <h1><T id="Türkiye'deki mülkünüzü yurt dışından ilan verin"/></h1>
      <p><T id="Almanya'da veya başka bir ülkede yaşıyorsanız Türkiye'deki evinizi, arsanızı veya iş yerinizi kendi dilinizde ilan verin. İlanınız sekiz dilde, Türkiye'deki ve yurt dışındaki alıcılara ulaşır."/></p>
      <div className="abroad-actions"><Link className="btn btn-accent" href="/ilan-ver"><T id="İlan Ver"/><ArrowRight size={17} aria-hidden="true"/></Link><Link className="btn btn-secondary" href="#nasil-calisir"><T id="Nasıl çalışır?"/></Link></div>
    </div></header>
    <div className="container">
      <ul className="abroad-benefits">{BENEFITS.map(({ icon: Icon, title, text }) => <li key={title}><span className="abroad-icon"><Icon size={22} aria-hidden="true"/></span><h2><T id={title}/></h2><p><T id={text}/></p></li>)}</ul>
      <section id="nasil-calisir" className="abroad-steps" aria-labelledby="abroad-steps-title">
        <h2 id="abroad-steps-title"><T id="Nasıl çalışır?"/></h2>
        <ol>{STEPS.map((step, index) => <li key={step.title}><b>{index + 1}</b><div><strong><T id={step.title}/></strong><p><T id={step.text}/></p></div></li>)}</ol>
        <p className="abroad-note"><T id="Bireysel üyeler 45 günde bir ilan verebilir. İlan, yayımlandığı andan itibaren 20 gün yayında kalır. Düzenleme veya silme yeni ilan hakkını erkene almaz."/></p>
        <p className="abroad-note"><T id="Birden fazla mülkünüz varsa veya emlak ofisiyseniz kurumsal üyelikle daha fazla ilan verebilirsiniz."/> <Link href="/paketler"><T id="Fiyatlar"/></Link></p>
        <div className="abroad-actions"><Link className="btn btn-accent" href="/ilan-ver"><T id="İlan Ver"/><ArrowRight size={17} aria-hidden="true"/></Link><Link className="btn btn-secondary" href="/hizmetler"><T id="Hizmetler"/></Link><Link className="btn btn-secondary" href="/iletisim"><T id="İletişim"/></Link></div>
      </section>
    </div>
  </main>;
}
