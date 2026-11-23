// Live updates for messaging (owner's request 2026-11-23): instead of waiting for the next 15-second check, the
// other person's page learns at once that a message arrived, was read, or that someone is typing. The server keeps
// the open connections of this container in memory (the site runs as a single Mittwald container); the stream is
// GET /api/live (Server-Sent Events), see app/api/live/route.ts and lib/live-client.ts. Events carry only ids, never
// message text: the page then loads the messages through the normal, access-checked /api/messages.
export type LiveEvent =
  | { type: "message"; listingId: string; peerId: string }
  | { type: "read"; listingId: string; peerId: string }
  | { type: "typing"; listingId: string; peerId: string };
type Listener = (event: LiveEvent) => void;
type Bus = { listeners: Map<string, Set<Listener>>; typing: Map<string, number> };

// At most this many open streams per account (tabs and devices); the oldest is closed for a new one.
export const MAX_STREAMS_PER_USER = 8;
// One typing signal per sender and thread per this many milliseconds.
export const TYPING_INTERVAL_MS = 2500;

// One bus per process, also when route bundles carry their own copy of this module.
const bus = (): Bus => {
  const store = globalThis as typeof globalThis & { __em24LiveBus?: Bus };
  return store.__em24LiveBus ??= { listeners: new Map(), typing: new Map() };
};

/** Starts listening for one account; returns the function that stops it. `onEvict` runs when a newer stream replaces this one. */
export function subscribe(userId: string, listener: Listener, onEvict?: () => void) {
  const { listeners } = bus();
  const set = listeners.get(userId) ?? new Set<Listener>();
  listeners.set(userId, set);
  if (set.size >= MAX_STREAMS_PER_USER) {
    const oldest = set.values().next().value as Listener & { evict?: () => void };
    set.delete(oldest); oldest.evict?.();
  }
  const entry = Object.assign((event: LiveEvent) => listener(event), { evict: onEvict });
  set.add(entry);
  return () => { set.delete(entry); if (!set.size) listeners.delete(userId); };
}

/** Sends an event to every open stream of these accounts; returns how many streams got it. */
export function publish(userIds: string[], event: LiveEvent) {
  let delivered = 0;
  for (const id of new Set(userIds)) for (const listener of bus().listeners.get(id) ?? []) {
    try { listener(event); delivered++; } catch { /* a closed stream; its cleanup removes it */ }
  }
  return delivered;
}

/** Whether a typing signal from this sender in this thread may go out now (rate limit). */
export function typingAllowed(senderId: string, listingId: string, peerId: string, now = Date.now()) {
  const { typing } = bus();
  const key = `${senderId}:${listingId}:${peerId}`, last = typing.get(key);
  if (last !== undefined && now - last < TYPING_INTERVAL_MS) return false;
  typing.set(key, now);
  if (typing.size > 5000) for (const [k, at] of typing) if (now - at > 60_000) typing.delete(k);
  return true;
}

export const openStreams = (userId: string) => bus().listeners.get(userId)?.size ?? 0;

/** One Server-Sent Events frame. */
export const sseFrame = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
