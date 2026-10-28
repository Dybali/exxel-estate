// Payment methods offered at checkout. Bank transfer is confirmed manually by an admin.
// A card provider (e.g. iyzico) would add an entry here plus a callback route that calls
// fulfillOrder() after verifying the provider's signature.
export type PaymentSettings = { BANK_ACCOUNT_NAME?: string; BANK_IBAN?: string; BANK_NAME?: string };
export type BankTransfer = { provider: "bank_transfer"; accountName: string; iban: string; bankName: string };

export function bankTransfer(settings: PaymentSettings): BankTransfer | null {
  const iban = (settings.BANK_IBAN || "").replace(/\s+/g, "").toUpperCase();
  if (!settings.BANK_ACCOUNT_NAME || !/^TR\d{24}$/.test(iban)) return null;
  return { provider: "bank_transfer", accountName: settings.BANK_ACCOUNT_NAME, iban: iban.replace(/(.{4})/g, "$1 ").trim(), bankName: settings.BANK_NAME || "" };
}
