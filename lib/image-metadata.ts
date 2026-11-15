// Removes location and other personal metadata from uploaded photos on the server, as a second line
// behind the browser re-encode (lib/photo-optimize.ts) which can fail or be skipped.
// JPEG: the GPS block inside EXIF is emptied (tags and their values zeroed) while orientation and the
// rest of EXIF stay, so photos are not shown sideways; XMP (which can repeat GPS) is dropped unless
// keepXmp (360° panoramas keep their GPano XMP). PNG: eXIf and text chunks are dropped. WebP: EXIF
// and XMP chunks are dropped. Anything that does not parse cleanly is returned unchanged.
const ascii = (bytes: Uint8Array, start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));
const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };

function clearExifGps(bytes: Uint8Array, start: number, end: number) {
  // start: first byte of the TIFF header inside the APP1 segment; end: segment end.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const order = ascii(bytes, start, 2);
  if (order !== "II" && order !== "MM") return;
  const little = order === "II";
  const u16 = (at: number) => view.getUint16(at, little), u32 = (at: number) => view.getUint32(at, little);
  const inside = (at: number, length: number) => at >= start && at + length <= end;
  const ifd0 = start + u32(start + 4);
  if (!inside(ifd0, 2)) return;
  const count = u16(ifd0);
  for (let index = 0; index < count; index++) {
    const entry = ifd0 + 2 + index * 12;
    if (!inside(entry, 12)) return;
    if (u16(entry) !== 0x8825) continue;
    const gps = start + u32(entry + 8);
    if (!inside(gps, 2)) return;
    const gpsCount = u16(gps);
    if (!inside(gps + 2, gpsCount * 12)) return;
    for (let item = 0; item < gpsCount; item++) {
      const tag = gps + 2 + item * 12, size = (TYPE_SIZE[u16(tag + 2)] || 1) * u32(tag + 4);
      if (size > 4) { const data = start + u32(tag + 8); if (inside(data, size)) bytes.fill(0, data, data + size); }
    }
    bytes.fill(0, gps + 2, gps + 2 + gpsCount * 12);
    view.setUint16(gps, 0, little);
  }
}

function stripJpeg(input: Uint8Array<ArrayBuffer>, keepXmp: boolean): Uint8Array<ArrayBuffer> {
  const bytes = input.slice(), parts: Uint8Array[] = [bytes.subarray(0, 2)];
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return input;
    const marker = bytes[offset + 1];
    if (marker === 0xda) break; // start of scan: the image data follows
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { parts.push(bytes.subarray(offset, offset + 2)); offset += 2; continue; }
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3], end = offset + 2 + length;
    if (length < 2 || end > bytes.length) return input;
    if (marker === 0xe1 && ascii(bytes, offset + 4, 6) === "Exif\0\0") clearExifGps(bytes, offset + 10, end);
    const xmp = marker === 0xe1 && ascii(bytes, offset + 4, 29) === "http://ns.adobe.com/xap/1.0/\0";
    if (!(xmp && !keepXmp)) parts.push(bytes.subarray(offset, end));
    offset = end;
  }
  parts.push(bytes.subarray(offset));
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) { out.set(part, at); at += part.length; }
  return out;
}

function stripPng(input: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> {
  const drop = new Set(["eXIf", "tEXt", "zTXt", "iTXt"]), parts: Uint8Array[] = [input.subarray(0, 8)];
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  let offset = 8;
  while (offset + 12 <= input.length) {
    const length = view.getUint32(offset), end = offset + 12 + length, type = ascii(input, offset + 4, 4);
    if (end > input.length) return input;
    if (!drop.has(type)) parts.push(input.subarray(offset, end));
    offset = end;
    if (type === "IEND") break;
  }
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) { out.set(part, at); at += part.length; }
  return out;
}

function stripWebp(input: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> {
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength), parts: Uint8Array[] = [];
  let offset = 12, vp8x = -1;
  while (offset + 8 <= input.length) {
    const type = ascii(input, offset, 4), size = view.getUint32(offset + 4, true), end = offset + 8 + size + (size % 2);
    if (offset + 8 + size > input.length) return input;
    if (type !== "EXIF" && type !== "XMP ") { if (type === "VP8X") vp8x = parts.reduce((sum, part) => sum + part.length, 12); parts.push(input.subarray(offset, Math.min(end, input.length))); }
    offset = end;
  }
  const total = parts.reduce((sum, part) => sum + part.length, 12), out = new Uint8Array(total);
  out.set(input.subarray(0, 12), 0);
  let at = 12;
  for (const part of parts) { out.set(part, at); at += part.length; }
  new DataView(out.buffer).setUint32(4, total - 8, true);
  if (vp8x >= 0) out[vp8x + 8] &= ~0x0c; // VP8X flags: clear the EXIF (0x08) and XMP (0x04) bits
  return out;
}

export function stripImageMetadata(bytes: Uint8Array<ArrayBuffer>, type: string, { keepXmp = false } = {}): Uint8Array<ArrayBuffer> {
  try {
    if (type === "image/jpeg") return stripJpeg(bytes, keepXmp);
    if (type === "image/png") return stripPng(bytes);
    if (type === "image/webp") return stripWebp(bytes);
  } catch { /* fall through: keep the upload as it is */ }
  return bytes;
}
