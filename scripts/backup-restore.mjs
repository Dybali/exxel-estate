#!/usr/bin/env node
// Decrypts an offsite database backup made by the site container (lib/db-backup-node.ts,
// docs/backups-monitoring.md). Runs on an admin machine from a checkout of this repository (it uses
// aws4fetch from node_modules for downloads), never in the server.
//
//   node scripts/backup-restore.mjs list
//   node scripts/backup-restore.mjs download mittwald-db/db-2026-11-05T060012Z.dump.enc --out db.dump
//   node scripts/backup-restore.mjs file ./db-2026-11-05T060012Z.dump.enc --out db.dump [--manifest ./db-2026-11-05T060012Z.json]
//
// Environment: BACKUP_ENCRYPTION_KEY (32 bytes, base64; never pass it on the command line), and for
// list/download R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, optional R2_BACKUP_BUCKET
// (default estatemarket24-backups). The GCM tag and the SHA-256 from the manifest are both checked;
// on any mismatch the output file is deleted and the exit code is 1.
// Restore into a fresh, empty database afterwards:
//   pg_restore --no-owner --no-privileges --exit-on-error --dbname "postgres://USER@HOST:5432/NEWDB" db.dump
import { createDecipheriv, createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, open, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

export const BACKUP_MAGIC = 'EM24DUMP';
export const BACKUP_VERSION = 1;
export const HEADER_BYTES = 21;
export const TAG_BYTES = 16;
const DEFAULT_BUCKET = 'estatemarket24-backups';

export function parseBackupKey(value) {
  const text = String(value || '').trim();
  if (!text) throw new Error('BACKUP_ENCRYPTION_KEY is not set');
  if (!/^[A-Za-z0-9+/]{43}=?$/.test(text)) throw new Error('BACKUP_ENCRYPTION_KEY must be 32 bytes, base64 encoded');
  const key = Buffer.from(text, 'base64');
  if (key.length !== 32) throw new Error('BACKUP_ENCRYPTION_KEY must be 32 bytes, base64 encoded');
  return key;
}

// Header: 8-byte magic "EM24DUMP", 1-byte version, 12-byte IV. Returns { version, iv, header }.
export function parseBackupHeader(bytes) {
  if (!bytes || bytes.length < HEADER_BYTES) throw new Error('Not a backup file (too short)');
  const header = Buffer.from(bytes.subarray(0, HEADER_BYTES));
  if (header.subarray(0, 8).toString('ascii') !== BACKUP_MAGIC) throw new Error('Not a backup file (wrong magic)');
  const version = header[8];
  if (version !== BACKUP_VERSION) throw new Error(`Unsupported backup format version ${version}`);
  return { version, iv: header.subarray(9, 21), header };
}

// Streams the ciphertext through AES-256-GCM; the tag (last 16 bytes) is checked at the end.
// Returns { bytes, sha256 } of the plaintext; deletes the output on any failure.
export async function decryptFile(input, output, key) {
  const size = (await stat(input)).size;
  if (size < HEADER_BYTES + TAG_BYTES) throw new Error('Not a backup file (too short)');
  const handle = await open(input, 'r');
  let header, authTag;
  try {
    const head = Buffer.alloc(HEADER_BYTES), tail = Buffer.alloc(TAG_BYTES);
    await handle.read(head, 0, HEADER_BYTES, 0);
    await handle.read(tail, 0, TAG_BYTES, size - TAG_BYTES);
    header = parseBackupHeader(head);
    authTag = tail;
  } finally { await handle.close(); }
  const decipher = createDecipheriv('aes-256-gcm', key, header.iv);
  decipher.setAAD(header.header);
  decipher.setAuthTag(authTag);
  const hash = createHash('sha256');
  let bytes = 0;
  const meter = new Transform({ transform(chunk, _e, done) { bytes += chunk.length; hash.update(chunk); done(null, chunk); } });
  const end = size - TAG_BYTES - 1;
  const source = end >= HEADER_BYTES ? createReadStream(input, { start: HEADER_BYTES, end }) : Readable.from([]);
  try {
    await pipeline(source, decipher, meter, createWriteStream(output));
  } catch (cause) {
    await rm(output, { force: true });
    const text = String(cause?.message || cause);
    throw new Error(/authenticate/i.test(text) ? 'Authentication failed: wrong BACKUP_ENCRYPTION_KEY or the file was altered' : text);
  }
  return { bytes, sha256: hash.digest('hex') };
}

export async function restoreFile(input, output, key, expected = {}) {
  const result = await decryptFile(input, output, key);
  const problems = [];
  if (expected.sha256 && expected.sha256 !== result.sha256) problems.push('SHA-256 does not match the manifest');
  if (expected.bytes != null && Number(expected.bytes) !== result.bytes) problems.push('size does not match the manifest');
  if (problems.length) { await rm(output, { force: true }); throw new Error(problems.join('; ')); }
  return { ...result, sha256Checked: !!expected.sha256 };
}

async function r2() {
  const { R2_ENDPOINT: endpoint, R2_ACCESS_KEY_ID: accessKeyId, R2_SECRET_ACCESS_KEY: secretAccessKey } = process.env;
  const bucket = process.env.R2_BACKUP_BUCKET || DEFAULT_BUCKET;
  if (!endpoint || !accessKeyId || !secretAccessKey) throw new Error('Set R2_ENDPOINT, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY');
  const { AwsClient } = await import('aws4fetch');
  const client = new AwsClient({ service: 's3', region: 'auto', accessKeyId, secretAccessKey });
  const base = `${endpoint.replace(/\/$/, '')}/${bucket}`;
  const url = (key) => `${base}/${key.split('/').map(encodeURIComponent).join('/')}`;
  return {
    async list(prefix) {
      const keys = [];
      let token = '';
      do {
        const query = new URL(base);
        query.searchParams.set('list-type', '2');
        query.searchParams.set('prefix', prefix);
        if (token) query.searchParams.set('continuation-token', token);
        const response = await client.fetch(query.toString());
        if (!response.ok) throw new Error(`R2 listing failed (${response.status})`);
        const xml = await response.text();
        for (const match of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
          const key = /<Key>([\s\S]*?)<\/Key>/.exec(match[1])?.[1] || '', size = Number(/<Size>(\d+)<\/Size>/.exec(match[1])?.[1] || 0);
          keys.push({ key, size });
        }
        token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? (/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/.exec(xml)?.[1] || '') : '';
      } while (token);
      return keys;
    },
    async download(key, file) {
      const response = await client.fetch(url(key));
      if (!response.ok || !response.body) throw new Error(`Download of ${key} failed (${response.status})`);
      await pipeline(Readable.fromWeb(response.body), createWriteStream(file));
    },
    async text(key) {
      const response = await client.fetch(url(key));
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`Download of ${key} failed (${response.status})`);
      return response.text();
    },
  };
}

function option(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main(args) {
  const [command, target] = args;
  if (command === 'list') {
    const store = await r2();
    const items = (await store.list('mittwald-db/')).filter((item) => item.key.endsWith('.dump.enc')).sort((a, b) => a.key.localeCompare(b.key));
    for (const item of items) console.log(`${item.key}\t${(item.size / 1048576).toFixed(1)} MB`);
    console.log(`${items.length} backup(s)`);
    return;
  }
  if (!['download', 'file'].includes(command) || !target) {
    console.error('usage: node scripts/backup-restore.mjs list | download <key> --out <file.dump> | file <file.dump.enc> --out <file.dump> [--manifest <file.json>]');
    process.exit(2);
  }
  const out = option(args, '--out');
  if (!out) throw new Error('--out <file.dump> is required');
  const key = parseBackupKey(process.env.BACKUP_ENCRYPTION_KEY);
  let input = target, manifest = null, temp = '';
  try {
    if (command === 'download') {
      if (!/^mittwald-db\/db-[0-9TZ-]+\.dump\.enc$/.test(target)) throw new Error('Expected a key like mittwald-db/db-2026-11-05T060012Z.dump.enc');
      const store = await r2();
      temp = await mkdtemp(path.join(tmpdir(), 'em24-restore-'));
      input = path.join(temp, 'backup.dump.enc');
      console.log(`downloading ${target}`);
      await store.download(target, input);
      const text = await store.text(target.replace(/\.dump\.enc$/, '.json'));
      manifest = text ? JSON.parse(text) : null;
    } else if (option(args, '--manifest')) {
      manifest = JSON.parse(await readFile(option(args, '--manifest'), 'utf8'));
    }
    if (!manifest) console.warn('warning: no manifest, only the encryption tag is checked (not the SHA-256)');
    const result = await restoreFile(input, out, key, manifest ? { sha256: manifest.sha256, bytes: manifest.bytes } : {});
    console.log(`ok: ${out} (${result.bytes} bytes, sha256 ${result.sha256}${result.sha256Checked ? ', matches the manifest' : ''}${manifest?.tables ? `, ${manifest.tables} tables` : ''})`);
    console.log(`next: pg_restore --no-owner --no-privileges --exit-on-error --dbname "<new empty database URL>" ${out}`);
  } finally {
    if (temp) await rm(temp, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((cause) => { console.error(`error: ${cause?.message || cause}`); process.exit(1); });
}
