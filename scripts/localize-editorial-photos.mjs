// One-time source preparation. Runtime pages only reference the optimized local files.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sources = ["lib/listings.ts", "components/AuthForm.tsx", "app/globals.css"];
const ids = new Set();
for (const source of sources) {
  const content = await readFile(path.join(root, source), "utf8");
  for (const match of content.matchAll(/photo-\d+-[a-z0-9]+/g)) ids.add(match[0]);
}

const target = path.join(root, "public", "editorial");
await mkdir(target, { recursive: true });
const failures = [];
let cursor = 0;
const photoIds = [...ids].sort();
async function worker() {
  while (cursor < photoIds.length) {
    const id = photoIds[cursor++];
    try {
      const url = new URL(`https://images.unsplash.com/${id}`);
      url.searchParams.set("auto", "format");
      url.searchParams.set("fit", "crop");
      url.searchParams.set("w", "1800");
      url.searchParams.set("q", "82");
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) throw new Error(`HTTP ${response.status}`);
      const input = Buffer.from(await response.arrayBuffer());
      const output = await sharp(input).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 76, effort: 5 }).toBuffer();
      await writeFile(path.join(target, `${id}.webp`), output);
      process.stdout.write(`${id} ${output.length} bytes\n`);
    } catch (error) {
      failures.push(`${id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
await Promise.all(Array.from({ length: 3 }, worker));
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
}
