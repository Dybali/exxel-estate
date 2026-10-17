import { readFileSync, writeFileSync } from "node:fs";

const source = new URL("../public/turkiye-iller.geojson", import.meta.url);
const destination = new URL("../public/turkiye-map-shapes.json", import.meta.url);
const data = JSON.parse(readFileSync(source, "utf8"));
const project = ([lon, lat]) => [18 + (lon - 25.665) * 47.2, 21 + (42.105 - lat) * 55.5];

const shapes = data.features.map((feature) => {
  const polygons = feature.geometry.type === "Polygon"
    ? [feature.geometry.coordinates]
    : feature.geometry.coordinates;
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  const path = polygons.map((polygon) => polygon.map((ring) => ring.map((point, index) => {
    const [x, y] = project(point);
    bounds[0] = Math.min(bounds[0], x);
    bounds[1] = Math.min(bounds[1], y);
    bounds[2] = Math.max(bounds[2], x);
    bounds[3] = Math.max(bounds[3], y);
    return `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join("") + "Z").join("")).join("");
  return {
    name: feature.properties.il_adi,
    path,
    cx: Number(((bounds[0] + bounds[2]) / 2).toFixed(1)),
    cy: Number(((bounds[1] + bounds[3]) / 2).toFixed(1)),
  };
});

writeFileSync(destination, JSON.stringify(shapes));
console.log(`Built ${shapes.length} province shapes`);
