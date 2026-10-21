export const REPORT_REASONS={fraud:'Dolandırıcılık şüphesi',incorrect:'Yanlış fiyat veya ilan bilgisi',unavailable:'Satılmış / kiralanmış ilan',duplicate:'Mükerrer ilan',inappropriate:'Uygunsuz içerik',other:'Diğer'} as const;
export const REPORT_STATES={open:'Yeni',reviewing:'İnceleniyor',resolved:'Sonuçlandı',dismissed:'İşlem gerekmiyor'} as const;
export type ReportState=keyof typeof REPORT_STATES;
export type ListingReport={id:string;listing_id:string;title_snapshot:string;reason:keyof typeof REPORT_REASONS;details:string;state:ReportState;resolution:string;created_at:string;updated_at:string;version:number};
export type AdminReport=ListingReport&{reporter_name:string;reporter_email:string;admin_note:string;listing_status:string|null;owner_name:string|null;owner_id:string|null;report_count:number};
export const REPORT_RESOLUTIONS={corrected:'İlan bilgileri düzeltildi',removed:'İlan incelemeye alındı',no_violation:'İhlal tespit edilmedi',duplicate:'Başka bildirimle birlikte değerlendirildi',other:'İnceleme tamamlandı'} as const;
export const REPORT_ACTIONS={reviewing:'İncelemeye başlandı',resolved:'Sonuçlandırıldı',dismissed:'İşlem gerekmiyor',reopen:'Yeniden açıldı',hold_listing:'İlan incelemeye alındı'} as const;
