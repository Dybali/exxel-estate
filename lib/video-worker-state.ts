// State of the video worker (lib/video-worker-node.ts), shared through globalThis because Next.js
// may load instrumentation.ts and the route handlers as separate module instances in one process.
// Nothing sets it on Cloudflare, so uploads report "not available" there.
export type VideoWorkerState = { running: boolean; reason?: string; wake?: () => void; stop?: () => void };
const KEY = "__exxelVideoWorker";
type Holder = { [KEY]?: VideoWorkerState };

export function videoWorkerState(): VideoWorkerState {
  return (globalThis as Holder)[KEY] ?? { running: false, reason: "not started" };
}
export function setVideoWorkerState(state: VideoWorkerState) {
  (globalThis as Holder)[KEY] = state;
}
// Lets the upload route start processing at once instead of waiting for the next poll.
export function wakeVideoWorker() {
  try { videoWorkerState().wake?.(); } catch { /* the worker polls anyway */ }
}
