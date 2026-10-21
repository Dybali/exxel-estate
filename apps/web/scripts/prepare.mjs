import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const web = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(web, "../..");
for (const directory of ["app", "components", "lib", "data", "public", "hooks"]) {
  const target = resolve(web, directory);
  if (!target.startsWith(`${web}${sep}`)) throw new Error("Unsafe generated path");
  await rm(target, { recursive: true, force: true });
  const excluded = new Set([join(root,"lib","office-verification-server.ts"),join(root,"lib","reports-server.ts"),join(root,"lib","tour-capture.ts"),join(root,"lib","server.ts"),join(root,"lib","neon-d1.ts"),join(root,"lib","external-r2.ts"),join(root,"lib","google-auth.ts"),join(root,"lib","neon-mail-auth.ts"),join(root,"lib","neon-identities.ts"),join(root,"lib","recovery-service.ts")]);
  await cp(join(root, directory), target, { recursive: true, filter: (source) => !source.startsWith(join(root, "app", "api")) && !excluded.has(source) });
}
await mkdir(join(web, "lib"), { recursive: true });
await cp(join(web, "scripts", "server-adapter.ts"), join(web, "lib", "server.ts"));
await writeFile(join(web, "generated-source.txt"), "Generated from the root Exxel Estate frontend by scripts/prepare.mjs.\n");
