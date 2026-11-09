// The e-mail that carries a one-time code (lib/email-codes.ts), in the visitor's language (Turkish
// by default). No links with tokens: the visitor types the code on the site. No transport imports,
// so it is tested without a bundler (tests/email-codes.test.mjs).
import { emailLayout, escapeHtml } from "./email-layout";
import { authEmailWords } from "./auth-email-translations";
import type { EmailCodePurpose } from "./email-codes";

const LOCALES = ["tr", "de", "fr", "en", "ar", "fa", "ru", "nl"] as const;
export type AuthEmailLocale = typeof LOCALES[number];
export const authEmailLocale = (value: unknown): AuthEmailLocale => LOCALES.includes(value as AuthEmailLocale) ? value as AuthEmailLocale : "tr";

export function authCodeEmail(purpose: EmailCodePurpose, code: string, localeInput: unknown) {
  if (!/^\d{6}$/.test(code)) throw new Error("Invalid code");
  const locale = authEmailLocale(localeInput);
  const t = (key: string) => locale === "tr" ? key : authEmailWords[key]?.[locale] || key;
  const en = (key: string) => authEmailWords[key]?.en || key;
  const reset = purpose === "reset";
  const subjectKey = reset ? "EstateMarket24 şifre sıfırlama kodunuz" : "EstateMarket24 e-posta doğrulama kodunuz";
  const titleKey = reset ? "Şifre sıfırlama kodunuz" : "E-posta doğrulama kodunuz";
  const introKey = reset ? "EstateMarket24 hesabınızın şifresini yenilemek için aşağıdaki kodu girin:" : "EstateMarket24 hesabınızın e-posta adresini doğrulamak için aşağıdaki kodu girin:";
  const notes = ["Kod 15 dakika geçerlidir ve yalnızca bir kez kullanılabilir.", "Bu kodu kimseyle paylaşmayın. EstateMarket24 ekibi sizden bu kodu asla istemez.", "Bu işlemi siz yapmadıysanız bu e-postayı yok sayın."].map(t);
  const big = `<span style="display:inline-block;font-family:'Courier New',monospace;font-size:34px;font-weight:800;letter-spacing:8px;background:#f4f5f1;padding:12px 18px;direction:ltr">${code}</span>`;
  const html = emailLayout({
    title: t(titleKey),
    // Turkish e-mails keep the usual English subtitle; other languages are fully localised.
    titleEn: locale === "tr" ? en(titleKey) : "",
    lines: [escapeHtml(t(introKey)), big, ...notes.map(escapeHtml)],
    lang: locale,
    dir: locale === "ar" || locale === "fa" ? "rtl" : "ltr",
  });
  const text = [t(titleKey), "", t(introKey), "", code, "", ...notes].join("\n");
  return { subject: t(subjectKey), html, text };
}
