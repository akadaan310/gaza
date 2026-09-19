// Processes raw Overpass API extracts into clean, provenance-tagged tile
// files consumed by the app at runtime (public/data/tiles/*.json).
//
// Each output tile records where its geometry came from so the app can
// classify every object it renders as REAL_DATA vs PROCEDURAL_OBJECT and
// never silently blur the two.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "public", "data", "tiles");
mkdirSync(outDir, { recursive: true });

const FETCHED_AT = "2026-09-19";
const SOURCE = {
  id: "openstreetmap",
  attribution: "© OpenStreetMap contributors (ODbL 1.0)",
  api: "Overpass API",
  fetchedAt: FETCHED_AT,
};

// Named real-world tiles we fetched via Overpass. `id` becomes the tile's
// key; `center` is the tile's real lat/lon origin used for local ENU math.
const TILE_SOURCES = [
  {
    id: "gaza_city_palestine_square",
    label: "Gaza City — Palestine Square",
    buildingsFile: "raw_buildings.json",
    roadsFile: "raw_roads.json",
    center: { lat: 31.5063, lon: 34.4616 },
  },
  {
    id: "jabalia",
    label: "Jabalia",
    combinedFile: "tiles/jabalia.json",
    center: { lat: 31.5316, lon: 34.4944 },
  },
  {
    id: "deir_al_balah",
    label: "Deir al-Balah",
    combinedFile: "tiles/deir_al_balah.json",
    center: { lat: 31.4102, lon: 34.3599 },
  },
  {
    id: "al_shati_camp",
    label: "Al-Shati (Beach) Camp",
    combinedFile: "tiles/al_shati_camp.json",
    center: { lat: 31.5306, lon: 34.4457 },
  },
];

function loadJson(rel) {
  return JSON.parse(readFileSync(path.join(__dirname, rel), "utf-8"));
}

// Shoelace formula on an equirectangular approximation — fine for the small
// (<1km) footprints we're working with.
function ringArea(coords) {
  let sum = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const [x1, y1] = coords[i];
    const [x2, y2] = coords[i + 1];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum / 2);
}

function centroid(coords) {
  let x = 0, y = 0;
  const n = coords.length - 1;
  for (let i = 0; i < n; i++) {
    x += coords[i][0];
    y += coords[i][1];
  }
  return [x / n, y / n];
}

function extractBuildings(elements) {
  const buildings = [];
  for (const el of elements) {
    if (el.type !== "way" || !el.tags?.building || !el.geometry) continue;
    if (el.geometry.length < 3) continue;
    const ring = el.geometry.map((g) => [g.lon, g.lat]);
    const first = ring[0], last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
    const areaDeg2 = ringArea(ring);
    if (areaDeg2 === 0) continue;
    const [cx, cy] = centroid(ring);
    // Rough m^2 conversion at Gaza's latitude (~31.5N): 1 deg lat ≈ 111,320m, 1 deg lon ≈ 95,000m
    const areaM2 = areaDeg2 * 111320 * 95000;
    const levels = parseInt(el.tags["building:levels"], 10);
    buildings.push({
      id: `osm:way/${el.id}`,
      footprint: ring,
      centroid: [cx, cy],
      areaM2: Math.round(areaM2),
      levels: Number.isFinite(levels) ? levels : null,
      tags: {
        building: el.tags.building,
        name: el.tags.name ?? null,
        amenity: el.tags.amenity ?? null,
      },
      classification: "REAL_DATA",
      source: SOURCE,
    });
  }
  return buildings;
}

function extractRoads(elements) {
  const roads = [];
  for (const el of elements) {
    if (el.type !== "way" || !el.tags?.highway || !el.geometry) continue;
    if (el.geometry.length < 2) continue;
    roads.push({
      id: `osm:way/${el.id}`,
      path: el.geometry.map((g) => [g.lon, g.lat]),
      highway: el.tags.highway,
      name: el.tags.name ?? null,
      classification: "REAL_DATA",
      source: SOURCE,
    });
  }
  return roads;
}

function extractCoastline(elements) {
  return elements
    .filter((el) => el.type === "way" && el.geometry)
    .map((el) => ({
      id: `osm:way/${el.id}`,
      path: el.geometry.map((g) => [g.lon, g.lat]),
      classification: "REAL_DATA",
      source: SOURCE,
    }));
}

// --- Build named real tiles ---
const manifest = { generatedAt: FETCHED_AT, source: SOURCE, tiles: [] };

for (const tile of TILE_SOURCES) {
  let buildingEls = [];
  let roadEls = [];
  if (tile.combinedFile) {
    const data = loadJson(tile.combinedFile);
    buildingEls = data.elements;
    roadEls = data.elements;
  } else {
    buildingEls = loadJson(tile.buildingsFile).elements;
    roadEls = loadJson(tile.roadsFile).elements;
  }
  const buildings = extractBuildings(buildingEls);
  const roads = extractRoads(roadEls);

  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const b of buildings) {
    for (const [x, y] of b.footprint) {
      minLon = Math.min(minLon, x); maxLon = Math.max(maxLon, x);
      minLat = Math.min(minLat, y); maxLat = Math.max(maxLat, y);
    }
  }

  const tileOut = {
    id: tile.id,
    label: tile.label,
    center: tile.center,
    bounds: { minLon, maxLon, minLat, maxLat },
    classification: "REAL_DATA",
    source: SOURCE,
    buildingCount: buildings.length,
    roadCount: roads.length,
    buildings,
    roads,
  };
  writeFileSync(path.join(outDir, `${tile.id}.json`), JSON.stringify(tileOut));
  manifest.tiles.push({
    id: tile.id,
    label: tile.label,
    center: tile.center,
    bounds: tileOut.bounds,
    buildingCount: buildings.length,
    roadCount: roads.length,
  });
  console.log(`${tile.id}: ${buildings.length} buildings, ${roads.length} roads`);
}

// --- Coastline (shared, not tied to one tile) ---
const coastEls = loadJson("raw_coastline.json").elements;
const coastline = extractCoastline(coastEls);
writeFileSync(path.join(outDir, "..", "coastline.json"), JSON.stringify({
  classification: "REAL_DATA",
  source: SOURCE,
  segments: coastline,
}));
console.log(`coastline: ${coastline.length} segments`);

writeFileSync(path.join(outDir, "..", "manifest.json"), JSON.stringify(manifest, null, 2));
console.log("Wrote manifest.json");
