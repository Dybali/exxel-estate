"use client";
import Link from "@/components/SafeLink";
import {ArrowRight, Plus} from "lucide-react";
import {useLocale} from "@/lib/i18n";

type Item = {q: string; a: string; link?: [href: string, label: string]};
type Group = {title: string; items: Item[]};

// Every answer reflects how the site works today (publication rules, quotas, reporting, XML import).
export const FAQ_GROUPS: Group[] = [
  {title: "Arama ve ilanlar", items: [
    {q: "estatemarket24'te nasıl ilan ararım?", a: "İlanlar sayfasında satılık, kiralık, günlük kiralık ve devren ilanları il, ilçe, mahalle, fiyat, metrekare, oda sayısı ve özelliklere göre filtreleyebilir, sonuçları harita üzerinde de görebilirsiniz. Aradığınızı kendi cümlelerinizle anlatmak isterseniz estateAI asistanını kullanabilirsiniz.", link: ["/ilanlar", "İlanları keşfet"]},
    {q: "Aramamı kaydedip yeni ilanlardan haberdar olabilir miyim?", a: "Evet. Üye girişi yaptıktan sonra aramanızı kaydedebilirsiniz. Hesabım → Bildirimler bölümünde, kayıtlı aramalarınıza uyan yeni ilanlar ve favorilerinizdeki fiyat değişiklikleri için günlük e-posta bildirimini açabilirsiniz."},
    {q: "İlanları karşılaştırabilir miyim?", a: "Evet. İlan kartlarındaki ve ilan sayfasındaki karşılaştırma seçeneğiyle en fazla dört ilanı fiyat, alan ve özellikler bakımından yan yana inceleyebilirsiniz.", link: ["/karsilastir", "Karşılaştırmayı aç"]},
    {q: "İlan sahibiyle nasıl iletişime geçerim?", a: "İlan sayfasındaki mesaj alanından ilan sahibine yazabilirsiniz; bunun için üye girişi gerekir. Yazışmalarınız Hesabım → Mesajlar bölümünde toplanır. Size gelen mesajlar, sitede seçtiğiniz dilde okuyabilmeniz için otomatik olarak çevrilebilir; orijinal metin her zaman görüntülenebilir."},
    {q: "“Doğrulanmış Emlakçı” rozeti ne anlama gelir?", a: "Rozet, Taşınmaz Ticareti Yetki Belgesi yönetici tarafından incelenip onaylanan emlak ofislerinde gösterilir. Rozet hesabın ve belgenin kontrol edildiğini gösterir; ilandaki her bilginin ayrıca doğrulandığı anlamına gelmez. Ödeme veya sözleşme öncesinde tapu kaydını ve belgeleri mutlaka kendiniz kontrol edin."},
    {q: "Sitenin dilini nasıl değiştiririm?", a: "Üst menüdeki dil seçiciden Türkçe, Almanca, Fransızca, İngilizce, Arapça, Farsça, Rusça, Hollandaca, İspanyolca veya İtalyanca seçebilirsiniz. İlan sahipleri ilanlarına kendi çevirilerini ekleyebilir; çevirisi eklenmemiş ilan metinleri otomatik olarak çevrilebilir."},
  ]},
  {title: "Yabancı alıcılar ve projeler", items: [
    {q: "Yabancı biri olarak Türkiye'de gayrimenkul alabilir miyim?", a: "Yabancıların taşınmaz edinmesi, vatandaşlığa ve taşınmazın bulunduğu bölgeye göre farklı kurallara tabidir. Ana sayfadaki yabancı alıcı rehberi temel adımları ve resmî kaynakları özetler. Bu bilgiler hukuki danışmanlık değildir; karar vermeden önce Tapu ve Kadastro Genel Müdürlüğü'ne danışın ve bağımsız bir avukattan destek alın."},
    {q: "Konut projeleri ve yer ayırtma talebi nasıl işler?", a: "Projeler sayfasında emlak ofisleri ve inşaat firmalarının yönetici onayından geçen konut projeleri yer alır. Bir daire tipi için üye olmadan ücretsiz yer ayırtma talebi gönderebilirsiniz; bilgileriniz proje yetkilisine iletilir ve sizinle telefon veya e-posta ile iletişime geçer. Yer ayırtma talebi bir ödeme veya satış sözleşmesi değildir.", link: ["/projeler", "Projeleri incele"]},
  ]},
  {title: "İlan verme", items: [
    {q: "İlan vermek ücretli mi?", a: "Şu anda ilan yayımlamak için ödeme alınmıyor ve paket satın almak gerekmiyor. Fiyatlandırma henüz belirlenmedi; güncel durumu Paketler ve fiyatlar sayfasında görebilirsiniz.", link: ["/paketler", "Paketler ve fiyatlar"]},
    {q: "Nasıl ilan veririm?", a: "Üye olup e-posta adresinizi doğruladıktan sonra İlan Ver sayfasındaki formu doldurun. Konum, fiyat, alan bilgileri ve en az bir fotoğraf gerekir. Bireysel üyelerin ilanı doğrudan yayımlanır. Emlak ofislerinin ilanları, ofis yetki belgesi onaylanana kadar incelemede bekler; onaydan sonra yeni ilanlar ek onay beklemeden yayımlanır.", link: ["/ilan-ver", "İlan Ver"]},
    {q: "Bireysel üyeler kaç ilan verebilir?", a: "Bireysel üyeler 45 günde bir ilan verebilir. İlan, yayımlandığı andan itibaren 20 gün yayında kalır. Düzenleme veya silme yeni ilan hakkını erkene almaz."},
    {q: "Fotoğraf ve video eklerken nelere dikkat etmeliyim?", a: "İlan başına en az bir, en fazla 30 fotoğraf ekleyebilirsiniz. Fotoğraflar yüklenirken küçültülür, WebP biçimine çevrilir ve estatemarket24 filigranı eklenir; konum gibi gizli dosya bilgileri silinir. YouTube veya Vimeo video bağlantısı ve Matterport veya Kuula sanal tur bağlantısı da ekleyebilirsiniz. Yalnızca ilandaki taşınmaza ait, kullanma hakkınız olan görselleri kullanın.", link: ["/ilan-kurallari", "İlan kuralları"]},
    {q: "İlanım neden yayımlanmadı veya yayından kalktı?", a: "Ofis belgesi onayı bekleyen emlak ofislerinin ilanları incelemede bekler. Yöneticiler İlan kurallarına aykırı ilanları reddedebilir veya yayından kaldırabilir. Bireysel ilanlar 20 günlük yayın süresi dolunca kendiliğinden yayından kalkar. İlanlarınızın durumunu Hesabım → İlanlarım bölümünde görebilirsiniz."},
    {q: "Bir ilanı nasıl bildiririm?", a: "İlan sayfasındaki “İlanı bildir” düğmesiyle dolandırıcılık şüphesi, yanlış fiyat veya bilgi, satılmış ya da kiralanmış ilan, mükerrer ilan veya uygunsuz içerik bildirebilirsiniz. Bunun için üye girişi ve doğrulanmış e-posta adresi gerekir. Bildirimleri yalnızca yetkili yöneticiler görür; kimliğiniz ilan sahibine gösterilmez. Bildirimlerinizin durumunu Hesabım → İlan bildirimlerim bölümünde izleyebilirsiniz."},
  ]},
  {title: "Emlak ofisleri ve kurumsal üyelik", items: [
    {q: "Emlak ofisi olarak nasıl üye olurum?", a: "Kayıt formunda emlak ofisi hesabını seçin ve e-posta adresinizi doğrulayın. Ardından Taşınmaz Ticareti Yetki Belgenizi (PDF, JPG veya PNG, en fazla 5 MB) Hesabım → Profilim bölümünden veya İlan Ver sayfasından yükleyin. Yönetici belgeyi ve hesabınızı onayladıktan sonra ilanlarınız yayımlanır ve Doğrulanmış Emlakçı rozeti gösterilir. İnşaat firmaları Kurumsal üyelik sayfasından başvurur.", link: ["/giris?mode=register&role=agent", "Emlak ofisi olarak kayıt ol"]},
    {q: "Çok sayıda ilanı tek seferde yükleyebilir miyim?", a: "Evet. İlan veren hesaplar, Hesabım → Müşteri talepleri bölümünden bir XML dosyasıyla tek seferde en fazla 100 ilan aktarabilir. Her ilan, ilan formundaki kurallarla aynı şekilde kontrol edilir; aynı dosya tekrar yüklendiğinde ilanlar ikinci kez oluşturulmaz.", link: ["/toplu-ilan", "Toplu ilan yükleme"]},
  ]},
  {title: "Hesap, gizlilik ve iletişim", items: [
    {q: "Hesabımı ve kişisel verilerimi nasıl sildirebilirim?", a: "Hesabınızın silinmesi veya KVKK ve GDPR kapsamındaki diğer haklarınız için İletişim sayfasındaki formda “Kişisel veriler (KVKK)” konusunu seçin ya da info@estatemarket24.com adresine yazın. Talebinizi hesabınızda kayıtlı e-posta adresinden gönderin; şifre veya kimlik belgesi göndermeyin. Ayrıntılar Gizlilik politikasında yer alır.", link: ["/gizlilik-politikasi", "Gizlilik politikası"]},
    {q: "Size nasıl ulaşabilirim?", a: "İletişim sayfasındaki formu kullanabilir veya info@estatemarket24.com adresine e-posta gönderebilirsiniz. Bir ilanla ilgili sorularınızı doğrudan ilan sahibine mesajla iletmeniz daha hızlı sonuç verir.", link: ["/iletisim", "İletişim"]},
  ]},
];

export function FaqPage() {
  const {t} = useLocale();
  const structured = {"@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ_GROUPS.flatMap((group) => group.items.map((item) => ({"@type": "Question", name: t(item.q), acceptedAnswer: {"@type": "Answer", text: t(item.a)}})))};
  return <main className="info-page faq-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(structured).replace(/</g, "\\u003c")}}/>
    <section className="info-hero"><div className="container">
      <span>{t("YARDIM MERKEZİ")}</span>
      <h1>{t("Sık sorulan sorular")}</h1>
      <p>{t("Arama, ilan verme, üyelik ve hesabınızla ilgili en sık sorulan soruların yanıtları.")}</p>
    </div></section>
    <div className="container info-body faq-body">
      <nav className="faq-index" aria-label={t("Konular")}>{FAQ_GROUPS.map((group, index) => <a key={group.title} href={`#faq-${index + 1}`}>{t(group.title)}</a>)}</nav>
      <div className="faq-groups">
        {FAQ_GROUPS.map((group, index) => <section key={group.title} id={`faq-${index + 1}`} className="faq-group">
          <h2>{t(group.title)}</h2>
          {group.items.map((item) => <details key={item.q} className="faq-item">
            <summary><span>{t(item.q)}</span><Plus size={18} aria-hidden="true"/></summary>
            <div className="faq-answer"><p>{t(item.a)}</p>{item.link && <Link href={item.link[0]} className="info-text-link">{t(item.link[1])}<ArrowRight size={15}/></Link>}</div>
          </details>)}
        </section>)}
        <aside className="info-cta"><div><h2>{t("Yanıtını bulamadınız mı?")}</h2><p>{t("Sorunuzu iletişim formuyla bize iletin.")}</p></div><Link href="/iletisim" className="info-button">{t("Bize yazın")}<ArrowRight size={17}/></Link></aside>
      </div>
    </div>
  </main>;
}
