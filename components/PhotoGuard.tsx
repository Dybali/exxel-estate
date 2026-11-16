"use client";
import { useEffect } from "react";

// Owner's request 2026-11-16: listing and firm photos (served from /api/media/) cannot be saved with a right click,
// dragged out of the page or saved with a long press on a phone. A deterrent only: screenshots stay possible,
// which is why every photo also carries the watermark (lib/photo-watermark-svg.ts).
const guarded = (target: EventTarget | null) => target instanceof HTMLImageElement && target.src.includes("/api/media/");
export function PhotoGuard() {
  useEffect(() => {
    const block = (event: Event) => { if (guarded(event.target)) event.preventDefault(); };
    document.addEventListener("contextmenu", block);
    document.addEventListener("dragstart", block);
    return () => { document.removeEventListener("contextmenu", block); document.removeEventListener("dragstart", block); };
  }, []);
  return null;
}
