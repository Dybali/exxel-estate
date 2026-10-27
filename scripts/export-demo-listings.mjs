import { copyFile, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = await readFile(resolve(root, "lib/listings.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
const require = createRequire(import.meta.url);
const localRequire = (name) => name === "./turkey-locations" ? { CITIES: [] } : require(name);
new Function("module", "exports", "require", compiled)(module, module.exports, localRequire);
const listings = module.exports.DEMO_LISTINGS;
if (!Array.isArray(listings) || listings.length === 0 || listings.some((item) => item.source !== "demo")) throw new Error("Demo listings export failed");
await writeFile(resolve(root, "apps/api/src/data/demo-listings.json"), JSON.stringify(listings, null, 2) + "\n");
await copyFile(resolve(root, "data/demo-companies.json"), resolve(root, "apps/api/src/data/demo-companies.json"));
console.log(`Exported ${listings.length} demo listings and company profiles for the independent API.`);
