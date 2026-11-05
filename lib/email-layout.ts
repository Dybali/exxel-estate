// HTML helpers for e-mails. No imports on purpose: lib/contact.ts (also used by client components)
// needs the layout, and must not pull the e-mail transports (lib/email.ts) into the browser bundle.
export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

// Simple bilingual (Turkish / English) layout shared by all notifications.
export function emailLayout(parts: { title: string; titleEn: string; lines: string[]; action?: { href: string; label: string }; unsubscribeUrl?: string }) {
  const body = parts.lines.map((line) => `<p style="margin:0 0 10px;line-height:1.5">${line}</p>`).join("");
  const action = parts.action ? `<p style="margin:18px 0"><a href="${escapeHtml(parts.action.href)}" style="background:#17334b;color:#fff;padding:12px 18px;text-decoration:none;font-weight:700;display:inline-block">${escapeHtml(parts.action.label)}</a></p>` : "";
  const footer = parts.unsubscribeUrl ? `<p style="font-size:12px;color:#7c887f;margin-top:24px">Bu e-postaları almak istemiyorsanız / To stop these emails: <a href="${escapeHtml(parts.unsubscribeUrl)}" style="color:#7c887f">abonelikten çık / unsubscribe</a></p>` : "";
  return `<!doctype html><html><body style="margin:0;background:#f4f5f1;padding:24px;font-family:Arial,sans-serif;color:#17334b"><div style="max-width:560px;margin:auto;background:#fff;padding:24px"><p style="font-weight:800;letter-spacing:.08em;font-size:12px;margin:0 0 16px">ESTATEMARKET24</p><h1 style="font-size:20px;margin:0 0 4px">${escapeHtml(parts.title)}</h1><p style="color:#7c887f;margin:0 0 16px">${escapeHtml(parts.titleEn)}</p>${body}${action}${footer}</div></body></html>`;
}
