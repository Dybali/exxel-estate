// Time-based one-time passwords (RFC 6238 / RFC 4226) and small WebCrypto helpers for the
// administrator two-factor login. No dependencies: works the same on Workers and Node.js.
const encoder = new TextEncoder();
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;

export function base32Encode(bytes: Uint8Array) {
  let bits = 0, value = 0, output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { output += BASE32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(text: string) {
  const clean = text.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0, value = 0;
  const output: number[] = [];
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index < 0) throw new Error("Invalid base32");
    value = (value << 5) | index; bits += 5;
    if (bits >= 8) { output.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(output);
}

const toBuffer = (bytes: Uint8Array) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
export const randomBytes = (length: number) => crypto.getRandomValues(new Uint8Array(length));
export const generateTotpSecret = () => base32Encode(randomBytes(20));
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");

export async function hotp(secret: Uint8Array, counter: number, digits = TOTP_DIGITS, hash: "SHA-1" | "SHA-256" | "SHA-512" = "SHA-1") {
  const message = new Uint8Array(8);
  let rest = counter;
  for (let i = 7; i >= 0; i--) { message[i] = rest % 256; rest = Math.floor(rest / 256); }
  const key = await crypto.subtle.importKey("raw", toBuffer(secret), { name: "HMAC", hash }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, message));
  const offset = mac[mac.length - 1] & 15;
  const binary = ((mac[offset] & 127) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, "0");
}

export const totpStep = (unixMs: number) => Math.floor(unixMs / 1000 / TOTP_STEP_SECONDS);
export const totp = (secretBase32: string, unixMs = Date.now(), digits = TOTP_DIGITS) => hotp(base32Decode(secretBase32), totpStep(unixMs), digits);

// Returns the matched time step, or null. Accepts one step of clock drift either way and
// rejects any step at or before lastUsedStep, so an observed code cannot be replayed.
export async function verifyTotp(secretBase32: string, code: string, unixMs = Date.now(), lastUsedStep: number | null = null, window = 1) {
  if (!/^\d{6}$/.test(code)) return null;
  const secret = base32Decode(secretBase32), current = totpStep(unixMs);
  for (let delta = -window; delta <= window; delta++) {
    const step = current + delta;
    if (lastUsedStep != null && step <= lastUsedStep) continue;
    if (equalStrings(await hotp(secret, step), code)) return step;
  }
  return null;
}

export function otpauthUri(secretBase32: string, account: string, issuer = "estatemarket24") {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_STEP_SECONDS}`;
}

export function equalStrings(a: string, b: string) {
  const left = encoder.encode(a), right = encoder.encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return diff === 0;
}

export async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (text: string) => Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
// The AES key is derived from the server secret with a purpose label, so the same secret can
// also sign cookies (hmacHex with a different label) without key reuse.
async function aesKey(serverKey: string) {
  const material = await crypto.subtle.digest("SHA-256", encoder.encode("em24-admin-totp-aes:" + serverKey));
  return crypto.subtle.importKey("raw", material, "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function encryptSecret(plain: string, serverKey: string, context: string) {
  const iv = randomBytes(12);
  const sealed = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(context) }, await aesKey(serverKey), encoder.encode(plain));
  return `v1.${b64url(iv)}.${b64url(new Uint8Array(sealed))}`;
}
export async function decryptSecret(sealed: string, serverKey: string, context: string) {
  const [version, iv, data] = sealed.split(".");
  if (version !== "v1" || !iv || !data) throw new Error("Unsupported secret format");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: toBuffer(fromB64url(iv)), additionalData: encoder.encode(context) }, await aesKey(serverKey), toBuffer(fromB64url(data)));
  return new TextDecoder().decode(plain);
}

// Recovery codes look like "K7QD-M2XA-9P": 10 base32 characters, about 50 bits each.
export function generateRecoveryCodes(count = 10) {
  return Array.from({ length: count }, () => { const raw = base32Encode(randomBytes(7)).slice(0, 10); return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`; });
}
export const normalizeRecoveryCode = (code: string) => code.toUpperCase().replace(/[^A-Z2-7]/g, "");
