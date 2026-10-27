import { writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

// MIT-licensed administrative data from https://github.com/mumeyyizbuyuk/turkiye-data
// Pinned so a routine build cannot silently change the list of addresses.
const commit = 'a0a453c75134e4a690d6c453cc7e8b514aa1d2c1';
const root = `https://raw.githubusercontent.com/mumeyyizbuyuk/turkiye-data/${commit}/data`;

async function source(name, compressed = false) {
  const response = await fetch(`${root}/${name}`);
  if (!response.ok) throw new Error(`Could not download ${name}: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  return JSON.parse((compressed ? gunzipSync(bytes) : bytes).toString('utf8'));
}

const [provinces, districts, neighborhoods] = await Promise.all([
  source('provinces.json'), source('districts.json'), source('neighborhoods.json.gz', true),
]);
if (provinces.length !== 81 || districts.length < 900 || neighborhoods.length < 30_000) {
  throw new Error('Location source count is unexpectedly incomplete.');
}

const collator = new Intl.Collator('tr-TR');
const byProvince = new Map(provinces.map(({ id, name }) => [id, name]));
const byDistrict = new Map(districts.map(({ id, name, province_id }) => [id, { name, provinceId: province_id }]));
const districtTree = Object.fromEntries(provinces.map(({ name }) => [name, []]));
const neighborhoodTree = Object.fromEntries(provinces.map(({ name }) => [name, {}]));
for (const { name, province_id } of districts) {
  const city = byProvince.get(province_id);
  if (!city) throw new Error(`Unknown province ${province_id}`);
  districtTree[city].push(name);
  neighborhoodTree[city][name] = [];
}
for (const { id, name, postal_code, district_id } of neighborhoods) {
  const district = byDistrict.get(district_id);
  if (!district) throw new Error(`Unknown district ${district_id}`);
  const city = byProvince.get(district.provinceId);
  neighborhoodTree[city][district.name].push({ id, name, postalCode: postal_code || '' });
}
const sortUnique = (items) => [...new Set(items)].sort(collator.compare);
for (const city of Object.keys(districtTree)) {
  districtTree[city] = sortUnique(districtTree[city]);
  for (const district of districtTree[city]) {
    const records = neighborhoodTree[city][district];
    if (!records.length) throw new Error(`${city}/${district} has no neighborhoods`);
    const exactLabels = new Map();
    for (const record of records) {
      const key = `${record.name}|${record.postalCode}`;
      exactLabels.set(key, (exactLabels.get(key) || 0) + 1);
    }
    neighborhoodTree[city][district] = records
      .map((record) => ({ ...record, label: `${record.name}${record.postalCode ? ` (${record.postalCode})` : ''}${exactLabels.get(`${record.name}|${record.postalCode}`) > 1 ? ` · ${record.id}` : ''}` }))
      .sort((a, b) => collator.compare(a.name, b.name) || collator.compare(a.postalCode, b.postalCode) || a.id - b.id);
  }
}
const sortedCities = Object.keys(districtTree).sort(collator.compare);
const orderedDistricts = Object.fromEntries(sortedCities.map((city) => [city, districtTree[city]]));
const orderedNeighborhoods = Object.fromEntries(sortedCities.map((city) => [city, neighborhoodTree[city]]));
mkdirSync('data/locations', { recursive: true });
writeFileSync('data/locations/districts.json', JSON.stringify(orderedDistricts));
writeFileSync('data/locations/neighborhoods.json', JSON.stringify(orderedNeighborhoods));
console.log(`${sortedCities.length} il, ${districts.length} ilçe, ${neighborhoods.length} mahalle generated.`);
