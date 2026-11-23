"use client";
import { useEffect, useRef, useState } from "react";
import type { LiveEvent } from "./live-events";

// Browser side of the live messaging updates (lib/live-events.ts): one EventSource per tab, shared by the header's
// unread badge and the inbox. When the connection is down, the pages keep their regular checks (15-60 s), so
// nothing is lost; while it is up they check rarely and react to events instead.
type Handler = (event: LiveEvent) => void;
const handlers = new Set<Handler>(), statusListeners = new Set<(up: boolean) => void>();
let source: EventSource | null = null, users = 0, connected = false, closeTimer: ReturnType<typeof setTimeout> | null = null;
const setConnected = (up: boolean) => { if (connected === up) return; connected = up; for (const listener of statusListeners) listener(up); };

function open() {
  if (source || typeof EventSource === "undefined") return;
  source = new EventSource("/api/live");
  source.addEventListener("ready", () => setConnected(true));
  source.onerror = () => setConnected(false); // the browser reconnects by itself (retry: 5000)
  for (const type of ["message", "read", "typing"] as const) source.addEventListener(type, (raw) => {
    let event: LiveEvent; try { event = JSON.parse((raw as MessageEvent).data) as LiveEvent; } catch { return; }
    for (const handler of handlers) handler(event);
  });
}
function retain() { users++; if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; } open(); }
// Closed shortly after the last user leaves, so moving between pages keeps the same connection.
function release() { users = Math.max(0, users - 1); if (users || closeTimer) return; closeTimer = setTimeout(() => { closeTimer = null; if (users) return; source?.close(); source = null; setConnected(false); }, 3000); }

/** Keeps the live connection open while mounted (only for a signed-in account) and calls `handler` on each event. */
export function useLiveEvents(enabled: boolean, handler: Handler) {
  const latest = useRef(handler); latest.current = handler;
  const [up, setUp] = useState(connected);
  useEffect(() => {
    if (!enabled) return;
    const relay: Handler = (event) => latest.current(event), status = (value: boolean) => setUp(value);
    handlers.add(relay); statusListeners.add(status); retain(); setUp(connected);
    return () => { handlers.delete(relay); statusListeners.delete(status); release(); };
  }, [enabled]);
  return enabled && up;
}

let lastTyping = 0;
/** Tells the other person of a thread that this account is typing (at most every 2.5 s). */
export function sendTyping(listingId: string, peerId: string) {
  const now = Date.now();
  if (!connected || now - lastTyping < 2500) return;
  lastTyping = now;
  fetch("/api/live", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "typing", listingId, peerId }), keepalive: true }).catch(() => {});
}
