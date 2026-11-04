import { spawn as nodeSpawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { setPriority, tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { MAX_VIDEO_SECONDS, videoFileKey, videoPosterKey } from "./listing-video";
import { failVideoJob, finishVideoJob, retryVideoJob, VIDEO_MAX_ATTEMPTS, type VideoDatabase, type VideoRow } from "./listing-video-store";
import type { VideoStorage } from "./video-storage";

// ffprobe/ffmpeg processing of one uploaded listing video (docs/listing-videos.md). Node only: the
// worker (lib/video-worker-node.ts) is the only importer, and it exists only in the Node build.
//
// Output: MP4, H.264 High / AAC, at most 1280x720 (landscape) or 720x1280 (portrait), never
// upscaled, at most 30 fps, CRF 23 with a 3 Mbit/s cap, moov atom first (faststart) so iPhone and
// browsers start playing before the whole file is loaded. Metadata (GPS location of phone videos)
// is dropped. Plus a JPEG poster from the first second. File paths are temp files only, hence the
// turbopackIgnore comments (the Node build must not trace the whole project for them).

export const FFMPEG_THREADS = 2;
// One job may not run longer than this (download, ffmpeg, upload); it is killed and retried.
export const VIDEO_JOB_TIMEOUT_MS = 20 * 60_000;
export const TEMP_PREFIX = "exxel-video-";

// Messages shown to the member (Turkish keys, translated in the browser).
export const VIDEO_ERRORS = {
  unreadable: "Dosya bir video olarak okunamadı. MP4 veya MOV biçiminde bir video yükleyin.",
  tooLong: "Video en fazla 3 dakika olabilir. Daha kısa bir video yükleyin.",
  failed: "Video işlenemedi. Başka bir video yükleyin.",
} as const;

// permanent: the file itself is the problem, retrying is useless.
export class VideoJobError extends Error {
  constructor(message: string, public permanent: boolean) { super(message); }
}

type ChildLike = {
  pid?: number;
  stdout: NodeJS.ReadableStream | null; stderr: NodeJS.ReadableStream | null;
  on(event: "error", listener: (error: Error) => void): unknown;
  on(event: "close", listener: (code: number | null, signal: NodeJS.Signals | null) => void): unknown;
  kill(signal?: NodeJS.Signals): boolean;
};
export type SpawnLike = (command: string, args: string[], options: { stdio: ["ignore", "pipe", "pipe"]; windowsHide: boolean }) => ChildLike;

// Long side 1280, short side 720, never larger than the source; even sizes for H.264.
const SCALE = "scale=w='min(iw,if(gte(iw,ih),1280,720))':h='min(ih,if(gte(iw,ih),720,1280))':force_original_aspect_ratio=decrease:force_divisible_by=2";

export function probeArgs(input: string) {
  return ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", input];
}

export function transcodeArgs(input: string, output: string, threads = FFMPEG_THREADS) {
  return [
    "-hide_banner", "-nostdin", "-y", "-loglevel", "error",
    "-threads", String(threads), "-i", input,
    "-map", "0:v:0", "-map", "0:a:0?", "-sn", "-dn", "-map_metadata", "-1", "-map_chapters", "-1",
    "-t", String(MAX_VIDEO_SECONDS + 1),
    "-vf", `${SCALE},format=yuv420p`, "-fpsmax", "30",
    "-c:v", "libx264", "-preset", "fast", "-profile:v", "high", "-level:v", "4.0",
    "-crf", "23", "-maxrate", "3M", "-bufsize", "6M",
    "-c:a", "aac", "-b:a", "128k", "-ac", "2", "-ar", "48000",
    "-movflags", "+faststart", "-threads", String(threads), "-filter_threads", "1",
    output,
  ];
}

export function posterArgs(input: string, output: string, duration: number, threads = FFMPEG_THREADS) {
  const at = Math.max(0, Math.min(1, duration / 4));
  return [
    "-hide_banner", "-nostdin", "-y", "-loglevel", "error", "-threads", String(threads),
    "-ss", at.toFixed(2), "-i", input, "-frames:v", "1", "-q:v", "3", "-update", "1", output,
  ];
}

export type ProbeResult = { duration: number; width: number; height: number; hasVideo: boolean };
export function parseProbe(json: string): ProbeResult {
  let data: { format?: { duration?: string }; streams?: { codec_type?: string; width?: number; height?: number; duration?: string; tags?: { rotate?: string }; side_data_list?: { rotation?: number }[] }[] };
  try { data = JSON.parse(json); } catch { return { duration: 0, width: 0, height: 0, hasVideo: false }; }
  const video = data.streams?.find((stream) => stream.codec_type === "video" && Number(stream.width) > 0);
  const duration = Number(data.format?.duration) || Number(video?.duration) || 0;
  if (!video) return { duration, width: 0, height: 0, hasVideo: false };
  // Phone videos are often stored landscape with a rotation flag; report the displayed size.
  const rotation = Math.abs(Number(video.side_data_list?.find((item) => item.rotation != null)?.rotation ?? video.tags?.rotate ?? 0)) % 180;
  const [width, height] = rotation === 90 ? [Number(video.height), Number(video.width)] : [Number(video.width), Number(video.height)];
  return { duration, width, height, hasVideo: true };
}

// Runs a command with a timeout and low CPU priority; resolves with its exit code and output tail.
export function runTool(spawn: SpawnLike, command: string, args: string[], timeoutMs = VIDEO_JOB_TIMEOUT_MS) {
  return new Promise<{ code: number | null; stdout: string; stderr: string; timedOut: boolean }>((resolve, reject) => {
    let child: ChildLike;
    try { child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true }); } catch (cause) { reject(cause); return; }
    // Below the web server, so a running job never slows down page requests much.
    if (child.pid) try { setPriority(child.pid, 10); } catch { /* not permitted: run at normal priority */ }
    let stdout = "", stderr = "", timedOut = false;
    child.stdout?.on("data", (chunk: Buffer) => { if (stdout.length < 1_000_000) stdout += chunk.toString(); });
    child.stderr?.on("data", (chunk: Buffer) => { stderr = (stderr + chunk.toString()).slice(-4000); });
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, timeoutMs);
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code) => { clearTimeout(timer); resolve({ code, stdout, stderr, timedOut }); });
  });
}

async function probe(spawn: SpawnLike, file: string) {
  const result = await runTool(spawn, "ffprobe", probeArgs(file), 2 * 60_000);
  if (result.timedOut) throw new VideoJobError("ffprobe timed out", false);
  if (result.code !== 0) throw new VideoJobError(VIDEO_ERRORS.unreadable, true);
  return parseProbe(result.stdout);
}

async function ffmpeg(spawn: SpawnLike, args: string[], timeoutMs: number) {
  const result = await runTool(spawn, "ffmpeg", args, timeoutMs);
  if (result.timedOut) throw new VideoJobError("ffmpeg timed out", false);
  if (result.code !== 0) {
    console.error("[video] ffmpeg failed", result.code, result.stderr.slice(-800));
    throw new VideoJobError(VIDEO_ERRORS.failed, true);
  }
}

export type JobDeps = { db: VideoDatabase; storage: VideoStorage; spawn?: SpawnLike; tmpRoot?: string; timeoutMs?: number; now?: () => Date };

// Processes one claimed job end to end. Never throws: the row ends ready, failed or queued again.
export async function processVideoJob(job: VideoRow, deps: JobDeps) {
  const spawn = deps.spawn ?? (nodeSpawn as unknown as SpawnLike), now = deps.now ?? (() => new Date());
  const started = Date.now(), timeoutMs = deps.timeoutMs ?? VIDEO_JOB_TIMEOUT_MS;
  const left = () => Math.max(Math.min(10_000, timeoutMs), timeoutMs - (Date.now() - started));
  let dir = "";
  try {
    dir = await mkdtemp(path.join(deps.tmpRoot ?? tmpdir(), TEMP_PREFIX));
    const input = path.join(dir, "input"), output = path.join(dir, "video.mp4"), poster = path.join(dir, "poster.jpg");
    try {
      const raw = await deps.storage.getRaw(job.raw_key);
      await pipeline(Readable.fromWeb(raw.body as import("node:stream/web").ReadableStream), createWriteStream(/* turbopackIgnore: true */ input));
    } catch (cause) { throw new VideoJobError(`download: ${(cause as Error)?.message || cause}`, false); }
    const source = await probe(spawn, input);
    if (!source.hasVideo) throw new VideoJobError(VIDEO_ERRORS.unreadable, true);
    // ffprobe is the authority on the length; the browser's check can be bypassed.
    if (source.duration > MAX_VIDEO_SECONDS + 1) throw new VideoJobError(VIDEO_ERRORS.tooLong, true);
    await ffmpeg(spawn, transcodeArgs(input, output), left());
    const result = await probe(spawn, output);
    if (!result.hasVideo) throw new VideoJobError(VIDEO_ERRORS.failed, true);
    await ffmpeg(spawn, posterArgs(output, poster, result.duration), Math.min(left(), 2 * 60_000));
    const mp4Key = videoFileKey(job.id), posterKey = videoPosterKey(job.id);
    try {
      for (const [file, key, type] of [[output, mp4Key, "video/mp4"], [poster, posterKey, "image/jpeg"]] as const) {
        const { size } = await stat(/* turbopackIgnore: true */ file);
        await deps.storage.putMedia(key, Readable.toWeb(createReadStream(/* turbopackIgnore: true */ file)) as ReadableStream<Uint8Array>, size, type);
      }
    } catch (cause) { throw new VideoJobError(`upload: ${(cause as Error)?.message || cause}`, false); }
    const finished = await finishVideoJob(deps.db, job.id, { mp4Key, posterKey, duration: Math.round(result.duration * 10) / 10, width: result.width, height: result.height }, now());
    if (!finished) {
      // Removed by its owner while it was being processed: drop what was just written.
      await Promise.allSettled([deps.storage.deleteMedia(mp4Key), deps.storage.deleteMedia(posterKey), deps.storage.deleteRaw(job.raw_key)]);
      return "removed" as const;
    }
    await deps.storage.deleteRaw(job.raw_key).catch((cause) => console.error("[video] raw delete failed", job.id, String(cause)));
    console.info(`[video] ready ${job.id} ${result.width}x${result.height} ${result.duration.toFixed(1)}s in ${Math.round((Date.now() - started) / 1000)}s`);
    return "ready" as const;
  } catch (cause) {
    const failure = cause instanceof VideoJobError ? cause : new VideoJobError(String((cause as Error)?.message || cause), false);
    console.error(`[video] job ${job.id} attempt ${job.attempts} failed: ${failure.message}`);
    try {
      if (failure.permanent || job.attempts >= VIDEO_MAX_ATTEMPTS) {
        await failVideoJob(deps.db, job.id, failure.permanent ? failure.message : VIDEO_ERRORS.failed, now());
        await deps.storage.deleteRaw(job.raw_key).catch(() => {});
        return "failed" as const;
      }
      await retryVideoJob(deps.db, job.id, now());
      return "retry" as const;
    } catch (inner) {
      // The lock expires and the job is picked up again.
      console.error("[video] could not record the job result", job.id, String(inner));
      return "retry" as const;
    }
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// Leftover temp folders from a container that stopped mid-job.
export async function removeStaleTempDirs(root = tmpdir(), olderThanMs = 6 * 3600_000) {
  const names = await readdir(root).catch(() => [] as string[]);
  for (const name of names) {
    if (!name.startsWith(TEMP_PREFIX)) continue;
    const full = path.join(root, name);
    const info = await stat(/* turbopackIgnore: true */ full).catch(() => null);
    if (info && Date.now() - info.mtimeMs > olderThanMs) await rm(full, { recursive: true, force: true }).catch(() => {});
  }
}

// ffmpeg and ffprobe are installed (Dockerfile: apk add ffmpeg).
export async function videoToolsAvailable(spawn: SpawnLike = nodeSpawn as unknown as SpawnLike) {
  for (const tool of ["ffmpeg", "ffprobe"]) {
    try { if ((await runTool(spawn, tool, ["-version"], 15_000)).code !== 0) return false; } catch { return false; }
  }
  return true;
}
