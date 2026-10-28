// Transactional email through Resend. Without RESEND_API_KEY and EMAIL_FROM every send is a no-op.
export type EmailSettings = { RESEND_API_KEY?: string; EMAIL_FROM?: string; SITE_URL?: string };
export type EmailMessage = { to: string; subject: string; html: string; text: string; unsubscribeUrl?: string };

export const emailReady = (settings: EmailSettings) => Boolean(settings.RESEND_API_KEY && settings.EMAIL_FROM);

export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export async function sendEmail(settings: EmailSettings, message: EmailMessage) {
  if (!emailReady(settings)) return { sent: false as const, reason: "not_configured" };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${settings.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: settings.EMAIL_FROM, to: [message.to], subject: message.subject, html: message.html, text: message.text,
      ...(message.unsubscribeUrl ? { headers: { "List-Unsubscribe": `<${message.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } } : {}),
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) { await response.body?.cancel(); return { sent: false as const, reason: `provider_${response.status}` }; }
  return { sent: true as const };
}

// Simple bilingual (Turkish / English) layout shared by all notifications.
export function emailLayout(parts: { title: string; titleEn: string; lines: string[]; action?: { href: string; label: string }; unsubscribeUrl?: string }) {
  const body = parts.lines.map((line) => `<p style="margin:0 0 10px;line-height:1.5">${line}</p>`).join("");
  const action = parts.action ? `<p style="margin:18px 0"><a href="${escapeHtml(parts.action.href)}" style="background:#17334b;color:#fff;padding:12px 18px;text-decoration:none;font-weight:700;display:inline-block">${escapeHtml(parts.action.label)}</a></p>` : "";
  const footer = parts.unsubscribeUrl ? `<p style="font-size:12px;color:#7c887f;margin-top:24px">Bu e-postaları almak istemiyorsanız / To stop these emails: <a href="${escapeHtml(parts.unsubscribeUrl)}" style="color:#7c887f">abonelikten çık / unsubscribe</a></p>` : "";
  return `<!doctype html><html><body style="margin:0;background:#f4f5f1;padding:24px;font-family:Arial,sans-serif;color:#17334b"><div style="max-width:560px;margin:auto;background:#fff;padding:24px"><p style="font-weight:800;letter-spacing:.08em;font-size:12px;margin:0 0 16px">ESTATEMARKET24</p><h1 style="font-size:20px;margin:0 0 4px">${escapeHtml(parts.title)}</h1><p style="color:#7c887f;margin:0 0 16px">${escapeHtml(parts.titleEn)}</p>${body}${action}${footer}</div></body></html>`;
}
