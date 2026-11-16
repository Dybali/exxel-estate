// The listing-photo watermark (owner's request 2026-11-16: harder to crop away): "estatemarket24" in the bottom-right
// corner plus a large, very faint diagonal mark across the centre. Drawn the same way by the browser
// (lib/photo-optimize.ts, canvas) and by the server (lib/photo-watermark-node.ts, sharp with this SVG).
export const WATERMARK_TEXT = "estatemarket24";

// Corner mark: size and margin follow the shorter edge so it reads the same on any aspect ratio.
export function watermarkLayout(width: number, height: number) {
  const fontSize = Math.max(14, Math.round(Math.min(width, height) * 0.035));
  const margin = Math.round(fontSize * 0.9);
  return { fontSize, x: width - margin, y: height - margin };
}
/** Centre mark: about two thirds of the diagonal long, rotated along it, nearly transparent. */
export function centerMarkLayout(width: number, height: number) {
  const diagonal = Math.hypot(width, height);
  const fontSize = Math.max(18, Math.round(diagonal * 0.075));
  const angle = -Math.atan2(height, width) * 180 / Math.PI;
  return { fontSize, angle, x: width / 2, y: height / 2, opacity: 0.16 };
}

/** Full-size SVG overlay with both marks, for sharp's composite. */
export function watermarkSvg(width: number, height: number) {
  const corner = watermarkLayout(width, height), center = centerMarkLayout(width, height);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
<defs><filter id="s" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="0" stdDeviation="${Math.round(corner.fontSize / 4)}" flood-color="#000" flood-opacity="0.45"/></filter></defs>
<text x="${center.x}" y="${center.y}" text-anchor="middle" dominant-baseline="middle" transform="rotate(${center.angle.toFixed(2)} ${center.x} ${center.y})" font-family="Liberation Sans, Arial, Helvetica, sans-serif" font-weight="700" font-size="${center.fontSize}" fill="#ffffff" fill-opacity="${center.opacity}" stroke="#000000" stroke-opacity="${(center.opacity / 2).toFixed(3)}" stroke-width="${Math.max(1, Math.round(center.fontSize / 40))}">${WATERMARK_TEXT}</text>
<text x="${corner.x}" y="${corner.y}" text-anchor="end" font-family="Liberation Sans, Arial, Helvetica, sans-serif" font-weight="700" font-size="${corner.fontSize}" fill="#ffffff" fill-opacity="0.72" filter="url(#s)">${WATERMARK_TEXT}</text>
</svg>`;
}
