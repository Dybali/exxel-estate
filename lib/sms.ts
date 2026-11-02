// SMS delivery for phone verification codes. The provider is chosen with SMS_PROVIDER:
//  netgsm  POST https://api.netgsm.com.tr/sms/rest/v2/send, Basic auth usercode:password,
//          JSON {msgheader, encoding, iysfilter, messages:[{msg,no}]}; success is {code:"00", jobid}.
//  twilio  POST https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json, Basic auth
//          SID:auth token, form fields To, From, Body; success is HTTP 201 with a Message resource.
// Without a complete configuration smsReady() is false and phone verification stays off.
import { env } from "./runtime";

export type SmsSettings = {
  SMS_PROVIDER?: string;
  NETGSM_USERCODE?: string; NETGSM_PASSWORD?: string; NETGSM_HEADER?: string;
  TWILIO_ACCOUNT_SID?: string; TWILIO_AUTH_TOKEN?: string; TWILIO_FROM?: string;
};
export type SmsProvider = { name: "netgsm" | "twilio"; send(to: string, text: string): Promise<void> };
type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

const basic = (user: string, password: string) => "Basic " + btoa(`${user}:${password}`);
const clean = (value: string | undefined) => (value || "").trim();

export function smsProvider(settings: SmsSettings, fetcher: Fetcher = (input, init) => fetch(input, init)): SmsProvider | null {
  const provider = clean(settings.SMS_PROVIDER).toLowerCase();
  if (provider === "netgsm") {
    const user = clean(settings.NETGSM_USERCODE), password = clean(settings.NETGSM_PASSWORD), header = clean(settings.NETGSM_HEADER);
    if (!user || !password || !header) return null;
    return {
      name: "netgsm",
      async send(to, text) {
        // Netgsm expects digits without "+" (e.g. 905551112233). iysfilter "0": informational
        // message, not commercial, so İYS consent is not required for a one-time code.
        const response = await fetcher("https://api.netgsm.com.tr/sms/rest/v2/send", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: basic(user, password) },
          body: JSON.stringify({ msgheader: header, encoding: "TR", iysfilter: "0", messages: [{ msg: text, no: to.replace(/\D/g, "") }] }),
        });
        const data = await response.json().catch(() => null) as { code?: string; description?: string } | null;
        if (!response.ok || data?.code !== "00") throw new Error(`Netgsm error ${data?.code || response.status}`);
      },
    };
  }
  if (provider === "twilio") {
    const sid = clean(settings.TWILIO_ACCOUNT_SID), token = clean(settings.TWILIO_AUTH_TOKEN), from = clean(settings.TWILIO_FROM);
    if (!/^AC[0-9a-f]{32}$/i.test(sid) || !token || !from) return null;
    return {
      name: "twilio",
      async send(to, text) {
        const response = await fetcher(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: basic(sid, token) },
          body: new URLSearchParams({ To: to, From: from, Body: text }).toString(),
        });
        if (!response.ok) { const data = await response.json().catch(() => null) as { code?: number } | null; throw new Error(`Twilio error ${data?.code || response.status}`); }
      },
    };
  }
  return null;
}

export const configuredSmsProvider = () => smsProvider(env as unknown as SmsSettings);
export const smsReady = () => Boolean(configuredSmsProvider());
