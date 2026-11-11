export function normalizeContactPhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const compact = value.trim().replace(/[\s().-]/g, "");
  if (!compact) return null;
  const normalized = /^0[5-9]\d{9}$/.test(compact) ? `+9${compact}`
    : /^[5-9]\d{9}$/.test(compact) ? `+90${compact}` : compact;
  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
}

export function whatsappHref(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}

// Example number shown in phone fields, in the visitor's language: owners abroad see their own country's format.
const PLACEHOLDERS: Record<string, string> = { tr: "+90 555 111 22 33", de: "+49 1512 3456789", fr: "+33 6 12 34 56 78", en: "+44 7400 123456", nl: "+31 6 12345678", ru: "+7 912 345 67 89", ar: "+966 50 123 4567", fa: "+98 912 345 6789" };
export const phonePlaceholder = (locale: string) => PLACEHOLDERS[locale] || PLACEHOLDERS.tr;
