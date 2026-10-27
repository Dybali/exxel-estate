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
