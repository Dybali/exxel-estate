// Turkish texts of the sales pages (components/SalesLegal.tsx): the distance sales contract with the preliminary
// information, the cancellation and refund terms and the KVKK notice (owner's request 2026-11-27, card payment
// application). Binding in Turkish under Turkish consumer law, so they are not translated. Have a lawyer review them
// before card sales start. In the strings, [text](/path) is a link and {email}, {phone}, {name}, {address} are the
// seller's details.
export const SALES_LEGAL_UPDATED = "2026-11-27";
/** Seller in Türkiye (the licensee in components/CompanyIdentity.tsx). Tax office, tax number and MERSİS show once filled in. */
export const SELLER = {
  name: "İlan Limited Şirketi",
  address: "Hükümet Caddesi No: 11, Torbalı / İzmir, Türkiye",
  phone: "0544 305 57 51",
  email: "info@estatemarket24.com",
  taxOffice: "", taxNumber: "", mersis: "",
};
export const SELLER_ROWS: [string, keyof typeof SELLER][] = [["Unvan", "name"], ["Adres", "address"], ["Telefon", "phone"], ["E-posta", "email"], ["Vergi dairesi", "taxOffice"], ["Vergi numarası", "taxNumber"], ["MERSİS numarası", "mersis"]];
export type SalesBlock = { p?: string; h?: string; clauses?: string[]; component?: "SellerCard" | "CompanyIdentity" | "LegalRights" };
export type SalesPage = { path: "/mesafeli-satis-sozlesmesi" | "/iptal-ve-iade-kosullari" | "/kvkk-aydinlatma-metni"; title: string; summary: string[]; sections: { id: string; title: string; blocks: SalesBlock[] }[] };
export const SALES_PAGES: Record<"contract" | "refund" | "kvkk", SalesPage> = {
 "contract": {
  "path": "/mesafeli-satis-sozlesmesi",
  "title": "Mesafeli Satış Sözleşmesi ve Ön Bilgilendirme Formu",
  "summary": [
   "Satıcı İlan Limited Şirketi, alıcı sipariş veren estatemarket24 üyesidir.",
   "Satılan ürünler dijital hizmetlerdir: ilan paketleri, ilan öne çıkarma ve firma paketleri.",
   "Fiyatlar Türk lirasıdır ve KDV dahildir; sipariş ekranındaki tutar dışında ücret alınmaz.",
   "Hizmet ödemeden sonra hesabınıza tanımlanır; tanımlanmadan önce iptal ederseniz ödemenin tamamı iade edilir."
  ],
  "sections": [
   {
    "id": "taraflar",
    "title": "Taraflar",
    "blocks": [
     {
      "p": "Bu Mesafeli Satış Sözleşmesi (“Sözleşme”), aşağıda bilgileri yer alan satıcı ile estatemarket24 üzerinden sipariş veren üye (“Alıcı”) arasında, siparişin elektronik ortamda onaylanmasıyla kurulur."
     },
     {
      "h": "Satıcı"
     },
     {
      "component": "SellerCard"
     },
     {
      "h": "Alıcı"
     },
     {
      "p": "Siparişi veren üyenin hesabında kayıtlı adı, soyadı, e-posta adresi ve telefon numarası. Fatura bilgileri sipariş sırasında alınır."
     },
     {
      "h": "Platform işletmecisi"
     },
     {
      "component": "CompanyIdentity"
     }
    ]
   },
   {
    "id": "konu",
    "title": "Sözleşmenin konusu",
    "blocks": [
     {
      "p": "Sözleşmenin konusu, Alıcının estatemarket24 üzerinden elektronik ortamda sipariş verdiği dijital hizmetin satışı ve ifasına ilişkin olarak 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği uyarınca tarafların hak ve yükümlülüklerinin belirlenmesidir."
     }
    ]
   },
   {
    "id": "hizmetler",
    "title": "Hizmetler, fiyatlar ve ön bilgilendirme",
    "blocks": [
     {
      "clauses": [
       "Satılan hizmetler: emlakçılar için ilan paketleri (Profesyonel, Prestij), yayındaki bir ilanın belirli süre öne çıkarılması ve hizmet firmaları ile müteahhitler için firma paketleri (Plus, Pro). Her hizmetin kapsamı, süresi ve fiyatı [Paketler ve fiyatlar](/paketler) sayfasında ve sipariş ekranında gösterilir.",
       "Fiyatlar Türk lirası (TL) cinsindendir ve KDV dahildir. Sipariş ekranında gösterilen toplam tutar dışında kargo, kurulum veya başka bir ücret alınmaz.",
       "Alıcı, siparişi onaylamadan önce satıcının kimliği ve iletişim bilgileri, hizmetin temel nitelikleri, KDV dahil toplam fiyatı, ödeme ve ifa koşulları, cayma hakkı ve şikâyet yolları konusunda bu sözleşme ve sipariş ekranı aracılığıyla bilgilendirildiğini kabul eder (Ön Bilgilendirme Formu)."
      ]
     }
    ]
   },
   {
    "id": "odeme",
    "title": "Ödeme",
    "blocks": [
     {
      "clauses": [
       "Ödeme, kredi kartı veya banka kartıyla lisanslı ödeme kuruluşu iyzico aracılığıyla ya da havale/EFT ile yapılır. Taksit seçenekleri, sunuluyorsa ödeme ekranında gösterilir.",
       "Kart bilgileri satıcı veya platform tarafından görülmez ve saklanmaz; ödeme kuruluşunun güvenli (SSL ile şifrelenmiş) ödeme sayfasında işlenir.",
       "Havale/EFT ile ödemede açıklamaya sipariş kodunun yazılması gerekir. Ödeme, satıcının hesabına geçtiğinde alınmış sayılır."
      ]
     }
    ]
   },
   {
    "id": "ifa",
    "title": "Hizmetin ifası",
    "blocks": [
     {
      "clauses": [
       "Kartla ödenen hizmet, ödeme onaylandıktan hemen sonra; havale/EFT ile ödenen hizmet, ödemenin hesaba geçtiğinin görülmesinden sonra en geç bir iş günü içinde Alıcının hesabına tanımlanır. Fiziksel teslimat yoktur.",
       "Hizmetin süresi tanımlandığı anda başlar. Etkin bir paket varken yeni paket alınırsa kalan süre korunur ve yeni süre eklenir.",
       "Satıcı, hizmeti ifa edemeyeceğini anlarsa bunu Alıcıya bildirir ve ödenen tutarı en geç 14 gün içinde iade eder."
      ]
     }
    ]
   },
   {
    "id": "cayma",
    "title": "Cayma hakkı",
    "blocks": [
     {
      "clauses": [
       "Alıcı, hizmet hesabına tanımlanmadan önce siparişini iptal edebilir veya 14 gün içinde cayma hakkını kullanabilir; bu durumda ödediği tutarın tamamı iade edilir.",
       "Mesafeli Sözleşmeler Yönetmeliği’nin 15. maddesinin 1. fıkrasının (ğ) bendi uyarınca, elektronik ortamda anında ifa edilen hizmetlerde cayma hakkı, Alıcının onayıyla ifaya başlandıktan sonra kullanılamaz. Alıcı, siparişi onaylarken hizmetin hemen tanımlanmasını istediğini ve tanımlandıktan sonra cayma hakkının sona ereceğini kabul eder.",
       "İptal ve iade ayrıntıları [İptal ve iade koşulları](/iptal-ve-iade-kosullari) sayfasındadır."
      ]
     }
    ]
   },
   {
    "id": "yukumlulukler",
    "title": "Tarafların yükümlülükleri",
    "blocks": [
     {
      "clauses": [
       "Alıcı, sipariş ve fatura için doğru bilgi vermekle ve hizmeti [Kullanım koşulları](/kullanim-kosullari) ile [İlan kuralları](/ilan-kurallari)’na uygun kullanmakla yükümlüdür.",
       "Satıcı, hizmeti sipariş ekranında belirtilen kapsam ve sürede sunmakla ve ödemeye ilişkin faturayı düzenlemekle yükümlüdür."
      ]
     }
    ]
   },
   {
    "id": "uyusmazlik",
    "title": "Şikâyet ve uyuşmazlıklar",
    "blocks": [
     {
      "p": "Şikâyetlerinizi {email} adresine veya {phone} numarasına iletebilirsiniz. Uyuşmazlıklarda, Ticaret Bakanlığınca her yıl ilan edilen parasal sınırlar içinde Alıcının yerleşim yerindeki veya işlemin yapıldığı yerdeki il ya da ilçe tüketici hakem heyetine, bu sınırların üzerinde tüketici mahkemesine başvurulabilir."
     }
    ]
   },
   {
    "id": "yururluk",
    "title": "Yürürlük",
    "blocks": [
     {
      "p": "Sözleşme, Alıcının siparişi elektronik ortamda onaylamasıyla kurulur ve yürürlüğe girer. Sözleşmenin metni sipariş sonrasında Alıcının e-posta adresine gönderilir ve bu sayfada yayımlanır."
     }
    ]
   }
  ]
 },
 "refund": {
  "path": "/iptal-ve-iade-kosullari",
  "title": "İptal ve İade Koşulları",
  "summary": [
   "Ödemesi yapılmamış siparişi Hesabım › Siparişlerim bölümünden ücretsiz iptal edebilirsiniz.",
   "Ödeme yapıldı ama hizmet henüz tanımlanmadıysa tutarın tamamı iade edilir.",
   "Tanımlanan dijital hizmetlerde cayma hakkı sona erer; bizden kaynaklanan bir sorunda kalan süre iade edilir veya uzatılır.",
   "İade, ödeme yaptığınız araca en geç 14 gün içinde yapılır."
  ],
  "sections": [
   {
    "id": "iptal",
    "title": "Siparişin iptali",
    "blocks": [
     {
      "clauses": [
       "Ödemesi yapılmamış (ödeme bekleyen) bir siparişi Hesabım › Siparişlerim bölümünden dilediğiniz zaman ücretsiz iptal edebilirsiniz.",
       "Ödemesi yapılmış ancak henüz hesabınıza tanımlanmamış bir sipariş için {email} adresine sipariş kodunuzla yazarak iptal isteyebilirsiniz; ödediğiniz tutarın tamamı iade edilir."
      ]
     }
    ]
   },
   {
    "id": "cayma",
    "title": "Cayma hakkı",
    "blocks": [
     {
      "clauses": [
       "estatemarket24’te satılan ilan paketleri, ilan öne çıkarma ve firma paketleri elektronik ortamda anında ifa edilen hizmetlerdir. Mesafeli Sözleşmeler Yönetmeliği’nin 15. maddesinin 1. fıkrasının (ğ) bendi uyarınca, hizmet onayınızla hesabınıza tanımlandıktan sonra cayma hakkı kullanılamaz.",
       "Hizmet tanımlanmadan önce, sipariş tarihinden itibaren 14 gün içinde gerekçe göstermeden cayabilirsiniz."
      ]
     }
    ]
   },
   {
    "id": "iade",
    "title": "Hangi durumlarda iade yapılır",
    "blocks": [
     {
      "clauses": [
       "Hizmet tanımlanmadan önce yapılan iptal ve cayma taleplerinde ödenen tutarın tamamı iade edilir.",
       "Hizmet bizden kaynaklanan teknik bir nedenle kullanılamazsa, kullanılamayan süre kadar süre uzatılır veya kalan süreye düşen tutar iade edilir; seçim size aittir.",
       "Aynı hizmet için yanlışlıkla iki kez ödeme yapıldıysa fazladan ödenen tutar iade edilir.",
       "Öne çıkarılan ilanın süresi dolar, ilan satılır, kiralanır veya ilan sahibi tarafından yayından kaldırılırsa kalan süre için iade yapılmaz."
      ]
     }
    ]
   },
   {
    "id": "yontem",
    "title": "İade yöntemi ve süresi",
    "blocks": [
     {
      "clauses": [
       "Kartla yapılan ödemeler aynı karta, havale/EFT ile yapılan ödemeler bildirdiğiniz ve sizin adınıza kayıtlı IBAN’a iade edilir.",
       "İade, talebin kabulünden itibaren en geç 14 gün içinde yapılır. Kart iadelerinin hesabınıza yansıma süresi bankanıza bağlıdır."
      ]
     }
    ]
   },
   {
    "id": "basvuru",
    "title": "Başvuru",
    "blocks": [
     {
      "p": "İptal ve iade taleplerinizi sipariş kodunuzla (EM24-…) birlikte {email} adresine veya {phone} numarasına iletebilirsiniz. Talebiniz en geç 3 iş günü içinde yanıtlanır. Satıcı ve sözleşme bilgileri için [Mesafeli satış sözleşmesi](/mesafeli-satis-sozlesmesi)."
     }
    ]
   }
  ]
 },
 "kvkk": {
  "path": "/kvkk-aydinlatma-metni",
  "title": "KVKK Aydınlatma Metni",
  "summary": [
   "Kişisel verileriniz üyelik, ilan, mesajlaşma, sipariş ve ödeme işlemleri için işlenir.",
   "Kart bilgileriniz bizde saklanmaz; ödeme kuruluşu iyzico tarafından işlenir.",
   "KVKK 11. maddedeki haklarınızı kullanmak için bize yazabilirsiniz."
  ],
  "sections": [
   {
    "id": "sorumlu",
    "title": "Veri sorumlusu",
    "blocks": [
     {
      "p": "6698 sayılı Kişisel Verilerin Korunması Kanunu (“KVKK”) uyarınca platformun veri sorumlusu aşağıdaki şirkettir:"
     },
     {
      "component": "CompanyIdentity"
     },
     {
      "p": "Ücretli hizmetlerin satışı, faturalandırılması ve ödeme işlemleri bakımından Türkiye’deki satıcı {name} ({address}) da veri sorumlusudur."
     }
    ]
   },
   {
    "id": "veriler",
    "title": "İşlenen kişisel veriler",
    "blocks": [
     {
      "clauses": [
       "Kimlik ve iletişim: ad, soyad, e-posta adresi, telefon numarası, firma adı.",
       "Müşteri işlem: ilanlar, mesajlar, randevu ve teklif talepleri, siparişler, fatura bilgileri.",
       "Finans: sipariş tutarı, ödeme durumu, iade için IBAN. Kart numarası ve güvenlik kodu tarafımızca işlenmez.",
       "İşlem güvenliği: IP adresi, oturum ve giriş kayıtları, cihaz ve tarayıcı bilgileri."
      ]
     }
    ]
   },
   {
    "id": "amaclar",
    "title": "İşleme amaçları ve hukuki sebepler",
    "blocks": [
     {
      "clauses": [
       "Üyelik, ilan yayımlama, mesajlaşma ve ücretli hizmetlerin satışı ve ifası: sözleşmenin kurulması ve ifası (KVKK m. 5/2-c).",
       "Fatura düzenlenmesi, muhasebe kayıtları ve yetkili kurumların talepleri: hukuki yükümlülük (KVKK m. 5/2-ç).",
       "Güvenlik, dolandırıcılığın önlenmesi ve hizmetin iyileştirilmesi: meşru menfaat (KVKK m. 5/2-f).",
       "Pazarlama iletileri ve istatistik çerezleri: açık rıza (KVKK m. 5/1); rızanızı dilediğiniz zaman geri alabilirsiniz."
      ]
     }
    ]
   },
   {
    "id": "aktarim",
    "title": "Aktarım",
    "blocks": [
     {
      "clauses": [
       "Ödeme işlemleri için lisanslı ödeme kuruluşu iyzico’ya; barındırma, e-posta ve dosya depolama hizmeti aldığımız sağlayıcılara (sunucular Almanya’dadır); muhasebe ve hukuk danışmanlarımıza; talep hâlinde yetkili kamu kurum ve kuruluşlarına aktarılabilir.",
       "Yurt dışındaki hizmet sağlayıcılara aktarım KVKK’nın 9. maddesine uygun olarak yapılır."
      ]
     }
    ]
   },
   {
    "id": "yontem",
    "title": "Toplama yöntemi",
    "blocks": [
     {
      "p": "Kişisel verileriniz web sitesi ve mobil arayüz üzerindeki formlar, hesabınız, mesajlaşma ve ödeme ekranları ile çerezler aracılığıyla elektronik ortamda toplanır."
     }
    ]
   },
   {
    "id": "haklar",
    "title": "Haklarınız",
    "blocks": [
     {
      "p": "KVKK’nın 11. maddesi uyarınca aşağıdaki haklara sahipsiniz:"
     },
     {
      "component": "LegalRights"
     }
    ]
   },
   {
    "id": "basvuru",
    "title": "Başvuru",
    "blocks": [
     {
      "p": "Başvurularınızı {email} adresine e-posta ile veya {address} adresine yazılı olarak iletebilirsiniz. Başvurunuz en geç 30 gün içinde ücretsiz yanıtlanır. Ayrıntılı bilgi: [Gizlilik politikası](/gizlilik-politikasi)."
     }
    ]
   }
  ]
 }
};
