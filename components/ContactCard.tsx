"use client";

import { useEffect, useState } from "react";
import Link from "@/components/SafeLink";
import { useLocale } from "@/lib/i18n";
import { ArrowUpRight, LockKeyhole } from "lucide-react";
import type { Listing } from "@/lib/listings";

export function ContactCard({ listing }: { listing: Listing }) {
  const { t } = useLocale();
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/account").then((response) => response.json()).then((data) => setUser((data as { user?: { id: string; name: string } }).user || null)).catch(() => setUser(null)).finally(() => setReady(true));
  }, []);

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending || message.trim().length < 2) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId: listing.id, message: message.trim() }) });
      const data = await response.json() as { error?: string; peerId?: string };
      if (!response.ok) throw new Error(data.error || "Mesaj gönderilemedi.");
      const destination = new URLSearchParams({ tab: "mesajlar", listingId: listing.id, peerId: data.peerId || listing.ownerId || "" });
      window.location.assign(`/hesabim?${destination.toString()}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Mesaj gönderilemedi.");
      setSending(false);
    }
  }

  return <div className="contact-card">
    <div className="contact-avatar"><span>E</span></div>
    <span className="eyebrow dark-eyebrow">{t("İLAN SAHİBİ")}</span>
    <h3>{listing.ownerName || "Exxel Estate"}</h3>
    <p>{t("Bu gayrimenkul hakkında ayrıntılı bilgi almak için ilan sahibine yazın.")}</p>
    {listing.source === "demo" ? <><div className="contact-demo-note">{t("Bu örnek ilanın gerçek bir sahibi yok; mesajlaşma gerçek ilanlarda kullanılabilir.")}</div><Link href="/ilanlar" className="contact-send">{t("İlanları keşfet")}<ArrowUpRight size={17}/></Link></> : !ready ? <span className="contact-lock">{t("Hesabınız kontrol ediliyor...")}</span> : user?.id === listing.ownerId ? <Link href="/hesabim?tab=mesajlar" className="contact-send">{t("Görüşmelerime git")}<ArrowUpRight size={17}/></Link> : user ? <form onSubmit={send}><label htmlFor="listing-message">{t("Mesajınız")}</label><textarea id="listing-message" value={message} onChange={(event) => setMessage(event.target.value)} minLength={2} maxLength={2000} required placeholder={t("Merhaba, bu gayrimenkul hakkında bilgi almak istiyorum...")} rows={4}/><button type="submit" className="contact-send" disabled={sending || message.trim().length < 2}>{t(sending ? "Gönderiliyor..." : "Mesaj gönder")}<ArrowUpRight size={17}/></button>{error && <span className="form-error" role="alert">{t(error)}</span>}</form> : <><Link href={`/giris?next=${encodeURIComponent(`/ilan/${listing.id}`)}`} className="contact-send">{t("Giriş yap ve iletişime geç")}<ArrowUpRight size={17}/></Link><span className="contact-lock"><LockKeyhole size={14}/>{t("İletişim için üyelik gereklidir")}</span></>}
  </div>;
}
