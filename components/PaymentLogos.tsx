"use client";
import { Lock } from "lucide-react";
import { useLocale } from "@/lib/i18n";

// Card brand marks in the footer, required by the card payment provider (owner's request 2026-11-27, iyzico).
// Drawn inline so they need no external file; replace with the provider's official logo band if it sends one.
export function PaymentLogos() {
  const { t } = useLocale();
  return <div className="footer-payments" aria-label={t("Kabul edilen kartlar")}>
    <svg viewBox="0 0 64 40" width="52" height="32" role="img" aria-label="Visa"><rect width="64" height="40" rx="6" fill="#fff"/><text x="32" y="27" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="19" fontWeight="900" fontStyle="italic" fill="#1A1F71" letterSpacing="-0.5">VISA</text></svg>
    <svg viewBox="0 0 64 40" width="52" height="32" role="img" aria-label="Mastercard"><rect width="64" height="40" rx="6" fill="#fff"/><circle cx="26" cy="20" r="11" fill="#EB001B"/><circle cx="38" cy="20" r="11" fill="#F79E1B"/><path d="M32 10.8a11 11 0 0 1 0 18.4a11 11 0 0 1 0-18.4z" fill="#FF5F00"/></svg>
    <span className="footer-ssl"><Lock size={14} aria-hidden="true"/>{t("SSL ile güvenli ödeme")}</span>
  </div>;
}
