"use client";
import Link from "@/components/SafeLink";
import {ArrowRight, BadgeCheck, Clock, Download, Images, Languages, ListChecks, Repeat} from "lucide-react";
import {useLocale} from "@/lib/i18n";
import {MAX_IMPORT_IMAGES, MAX_IMPORT_LISTINGS} from "@/lib/listing-import";

const BENEFITS = [
  {Icon: Clock, title: "Zaman kazanın", text: "Portföyünüzü tek tek girmek yerine tek bir dosyayla aktarın. Her ilan, ilan formundaki kurallarla aynı şekilde kontrol edilir."},
  {Icon: ListChecks, title: "Önce kontrol, sonra aktarma", text: "Dosyanız tarayıcınızda okunur; hatalı ilanlar gerekçesiyle tabloda gösterilir. Yalnızca geçerli ilanlar aktarılır."},
  {Icon: Repeat, title: "Tekrara karşı korumalı", text: "Her ilan ref kodunuzla eşleştirilir. Aynı dosyayı yeniden yüklediğinizde ilanlar ikinci kez oluşturulmaz."},
  {Icon: Images, title: "Fotoğraflar otomatik", text: "Herkese açık https fotoğraf adresleri sunucumuz üzerinden indirilir, küçültülür ve filigranlanır."},
  {Icon: Languages, title: "Çok dilli ilanlar", text: "Her ilana sitedeki yabancı diller için kendi başlık ve açıklama çevirilerinizi ekleyebilirsiniz."},
  {Icon: BadgeCheck, title: "Doğrulanmış Emlakçı rozeti", text: "Belgesi onaylanan ofislerin ilanları ek onay beklemeden yayımlanır ve rozetle gösterilir."},
];

const STEPS = [
  ["Emlak ofisi olarak üye olun", "Kayıt formunda emlak ofisi hesabını seçin ve e-posta adresinizi doğrulayın."],
  ["Ofis belgenizi onaylatın", "Taşınmaz Ticareti Yetki Belgenizi Hesabım → Profilim bölümünden yükleyin. Yönetici belgeyi ve hesabınızı inceleyip onaylar."],
  ["XML dosyanızı yükleyin", "Hesabım → Müşteri talepleri bölümündeki XML aktarma alanından dosyanızı seçin, kontrol sonuçlarını inceleyin ve aktarmayı başlatın."],
] as const;

// Element, required, value. Element names are XML and stay as they are in every language.
const FIELDS: [string, string, string][] = [
  ["title", "Evet", "5–150 karakter"],
  ["description", "Evet", "20–5000 karakter"],
  ["purpose", "Evet", "satilik, kiralik, gunluk, devren"],
  ["type", "Evet", "Gayrimenkul tipi, ör. daire, villa, mustakil, arsa, ticari"],
  ["price @currency", "Evet", "Pozitif sayı, Türk lirası; currency özniteliği yoksa TRY kabul edilir, başka para birimi kabul edilmez"],
  ["city, district", "Evet", "Türkiye il ve ilçe adı"],
  ["neighborhood @postalCode", "Evet", "Mahalle adı; aynı adlı mahallelerde posta kodu gerekir"],
  ["grossArea", "Evet", "Brüt alan, m², tam sayı"],
  ["netArea, plotArea, gardenArea", "Villalarda zorunlu", "m², tam sayı (bahçe yoksa 0)"],
  ["rooms", "Hayır", "Oda sayısı, ör. 3+1"],
  ["bedrooms, bathrooms, buildingAge, floor, totalFloors", "Hayır", "Tam sayı"],
  ["heating, furnished", "Hayır", "Isınma türü; eşyalı ise 1, değilse 0"],
  ["amenities / amenity", "Hayır", "Sitedeki özellik adları, ör. Asansör, Otopark, Havuz"],
  ["images / image", "Evet", "1–20 herkese açık https fotoğraf adresi; JPG, PNG veya WEBP, en fazla 25 MB"],
  ["videoUrl, tourUrl", "Hayır", "YouTube veya Vimeo video, Matterport veya Kuula sanal tur bağlantısı (https)"],
  ["translations / translation @lang", "Hayır", "de, fr, en, ar, fa, ru, nl için title ve description"],
];

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<listings version="1">
  <listing ref="OFFICE-001">
    <title>...</title>
    <description>...</description>
    <purpose>satilik</purpose>
    <type>daire</type>
    <price currency="TRY">6450000</price>
    <city>...</city>
    <district>...</district>
    <neighborhood postalCode="35040">...</neighborhood>
    <grossArea>135</grossArea>
    <rooms>3+1</rooms>
    <images>
      <image>https://example.com/photo-1.jpg</image>
    </images>
    <translations>
      <translation lang="en">
        <title>...</title>
        <description>...</description>
      </translation>
    </translations>
  </listing>
</listings>`;

// Marketing and how-to page for agencies: bulk listing upload with our XML format (docs/xml-import.md).
export function BulkUploadPage() {
  const {t} = useLocale();
  return <main className="info-page bulk-page">
    <section className="info-hero bulk-hero"><div className="container">
      <span>{t("EMLAK OFİSLERİ İÇİN")}</span>
      <h1>{t("Toplu ilan yükleme")}</h1>
      <p>{t("Portföyünüzü tek bir XML dosyasıyla aktarın: dosya başına en fazla {n} ilan, fotoğraflarıyla birlikte.").replace("{n}", String(MAX_IMPORT_LISTINGS))}</p>
      <div className="info-hero-actions"><Link href="/giris?mode=register&role=agent" className="info-button">{t("Emlak ofisi olarak kayıt ol")}<ArrowRight size={17}/></Link><Link href="/kurumsal-uyelik" className="info-button secondary">{t("İnşaat firması üyeliği")}</Link></div>
    </div></section>
    <div className="container info-body">
      <section className="bulk-benefits" aria-label={t("Avantajlar")}>{BENEFITS.map(({Icon, title, text}) => <article key={title} className="info-card"><Icon size={22}/><h2>{t(title)}</h2><p>{t(text)}</p></article>)}</section>

      <section className="bulk-section"><h2>{t("Üç adımda başlayın")}</h2>
        <ol className="bulk-steps">{STEPS.map(([title, text], index) => <li key={title}><span>{index + 1}</span><div><h3>{t(title)}</h3><p>{t(text)}</p></div></li>)}</ol>
      </section>

      <section className="bulk-section"><h2>{t("XML biçimi")}</h2>
        <p>{t("Kök öğe <listings version=\"1\">, her ilan bir <listing ref=\"…\"> öğesidir. ref kodu hesabınız içinde benzersiz olmalıdır.")}</p>
        <div className="bulk-table-wrap" tabIndex={0} role="region" aria-label={t("XML alanları")}><table className="bulk-table"><thead><tr><th>{t("Öğe")}</th><th>{t("Zorunlu mu?")}</th><th>{t("Değer")}</th></tr></thead>
          <tbody>{FIELDS.map(([element, required, value]) => <tr key={element}><td><code>{element}</code></td><td>{t(required)}</td><td>{t(value)}</td></tr>)}</tbody></table></div>
        <ul className="bulk-notes">
          <li>{t("Dosya en fazla 2 MB olabilir. İlan başına en fazla {n} fotoğraf aktarılır.").replace("{n}", String(MAX_IMPORT_IMAGES))}</li>
          <li>{t("Fotoğraflar sırayla işlendiği için 100 ilanlık bir aktarma birkaç dakika sürebilir; aktarma bitene kadar sayfayı açık tutun.")}</li>
          <li>{t("Kota, ofis doğrulaması, konum ve onay kuralları ilan formundakiyle aynıdır. Aktarılmış bir ilanı değiştirmek için İlanlarım bölümünü kullanın.")}</li>
        </ul>
        <pre className="bulk-sample" dir="ltr"><code>{SAMPLE}</code></pre>
        <a className="info-button secondary dark" href="/xml-ornek-ilanlar.xml" download><Download size={17}/>{t("Örnek XML dosyasını indir")}</a>
      </section>

      <aside className="info-cta"><div><h2>{t("Portföyünüzü estatemarket24'e taşıyın")}</h2><p>{t("Ücretsiz üye olun; ofis belgeniz onaylandıktan sonra ilanlarınızı toplu olarak aktarın. Sorularınız için bize yazın.")}</p></div><div className="info-cta-actions"><Link href="/giris?mode=register&role=agent" className="info-button">{t("Emlak ofisi olarak kayıt ol")}<ArrowRight size={17}/></Link><Link href="/iletisim" className="info-button secondary">{t("İletişim")}</Link></div></aside>
    </div>
  </main>;
}
