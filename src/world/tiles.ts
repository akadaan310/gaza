// The tile-streaming layer. Real OSM tiles are irregular islands of
// verified geometry; everywhere else on the Gaza Strip is covered by a
// deterministic procedural grid so the whole strip is walkable, with the
// real coastline enforced as the land/sea boundary. Every produced object
// carries a Provenance so the renderer and Research Mode never have to
// guess what they're looking at.
import manifest from "../../public/data/manifest.json";
import { lonLatToLocal, hashString, mulberry32, tileKeyForLocal, TILE_SIZE_M, WORLD_ORIGIN } from "./geo";
import { isLand } from "./coastline";
import type { Provenance } from "../data/provenance";

export interface BuildingNode {
  id: string;
  footprintLocal: [number, number][];
  centroidLocal: [number, number];
  heightM: number;
  areaM2: number;
  name: string | null;
  provenance: Provenance;
}

export interface RoadSegment {
  id: string;
  pathLocal: [number, number][];
  highway: string;
  provenance: Provenance;
}

export interface WorldTile {
  key: string;
  origin: [number, number];
  buildings: BuildingNode[];
  roads: RoadSegment[];
  isRealData: boolean;
  label?: string;
  groundBounds: { minX: number; maxX: number; minY: number; maxY: number };
}

interface RealTileManifestEntry {
  id: string;
  label: string;
  center: { lon: number; lat: number };
  bounds: { minLon: number; maxLon: number; minLat: number; maxLat: number };
  buildingCount: number;
  roadCount: number;
}

interface RealTileFile {
  id: string;
  label: string;
  buildings: Array<{
    id: string;
    footprint: [number, number][];
    centroid: [number, number];
    areaM2: number;
    levels: number | null;
    tags: { building: string; name: string | null; amenity: string | null };
  }>;
  roads: Array<{ id: string; path: [number, number][]; highway: string; name: string | null }>;
}

const realTileManifest = (manifest as { tiles: RealTileManifestEntry[] }).tiles;
const realTileCache = new Map<string, Promise<WorldTile>>();

const OSM_SOURCE: Provenance["source"] = {
  id: "openstreetmap",
  attribution: "© OpenStreetMap contributors (ODbL 1.0)",
  api: "Overpass API",
  fetchedAt: "2026-09-19",
};

function estimateHeight(levels: number | null, seed: number): number {
  if (levels && levels > 0) return levels * 3.2; // DERIVED_DATA: real level count -> height
  const rng = mulberry32(seed);
  return 3.2 * (2 + Math.floor(rng() * 4)); // no level tag: estimated 2-5 storeys
}

async function loadRealTile(entry: RealTileManifestEntry): Promise<WorldTile> {
  const res = await fetch(`/data/tiles/${entry.id}.json`);
  const data: RealTileFile = await res.json();

  const buildings: BuildingNode[] = data.buildings.map((b) => {
    const footprintLocal = b.footprint.map(([lon, lat]) => lonLatToLocal({ lon, lat }));
    const centroidLocal = lonLatToLocal({ lon: b.centroid[0], lat: b.centroid[1] });
    const seed = hashString(b.id);
    return {
      id: b.id,
      footprintLocal,
      centroidLocal,
      heightM: estimateHeight(b.levels, seed),
      areaM2: b.areaM2,
      name: b.tags.name,
      provenance: {
        classification: b.levels ? "REAL_DATA" : "DERIVED_DATA",
        source: OSM_SOURCE,
        confidence: b.levels ? "verified" : "estimated",
        note: b.levels
          ? "Footprint and storey count from OpenStreetMap."
          : "Footprint from OpenStreetMap; height estimated (no building:levels tag).",
      },
    };
  });

  const roads: RoadSegment[] = data.roads.map((r) => ({
    id: r.id,
    pathLocal: r.path.map(([lon, lat]) => lonLatToLocal({ lon, lat })),
    highway: r.highway,
    provenance: { classification: "REAL_DATA", source: OSM_SOURCE, confidence: "verified" },
  }));

  const origin = buildings[0]?.centroidLocal ?? lonLatToLocal(entry.center);
  const pad = 40;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const b of buildings) {
    for (const [x, y] of b.footprintLocal) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  if (!Number.isFinite(minX)) {
    minX = origin[0] - 100; maxX = origin[0] + 100;
    minY = origin[1] - 100; maxY = origin[1] + 100;
  }
  const groundBounds = { minX: minX - pad, maxX: maxX + pad, minY: minY - pad, maxY: maxY + pad };
  return {
    key: `real:${entry.id}`,
    origin,
    buildings,
    roads,
    isRealData: true,
    label: entry.label,
    groundBounds,
  };
}

export function getRealTiles(): Array<{
  key: string;
  label: string;
  centerLocal: [number, number];
  load: () => Promise<WorldTile>;
}> {
  return realTileManifest.map((entry) => ({
    key: `real:${entry.id}`,
    label: entry.label,
    centerLocal: lonLatToLocal(entry.center),
    load: () => {
      if (!realTileCache.has(entry.id)) {
        realTileCache.set(entry.id, loadRealTile(entry));
      }
      return realTileCache.get(entry.id)!;
    },
  }));
}

// Bounding boxes (in local meters) of real tiles, precomputed so we can
// skip generating procedural buildings underneath them.
const realTileLocalBounds = realTileManifest.map((entry) => {
  const min = lonLatToLocal({ lon: entry.bounds.minLon, lat: entry.bounds.minLat });
  const max = lonLatToLocal({ lon: entry.bounds.maxLon, lat: entry.bounds.maxLat });
  return { minX: min[0], maxX: max[0], minY: min[1], maxY: max[1] };
});

function overlapsRealTile(minX: number, maxX: number, minY: number, maxY: number): boolean {
  return realTileLocalBounds.some(
    (b) => minX < b.maxX && maxX > b.minX && minY < b.maxY && maxY > b.minY
  );
}

// PROCEDURAL_OBJECT generation for every grid cell outside the fetched
// real-data islands. Deterministic per (tx,ty): same seed, same block
// layout, every time — "computed", not random dressing.
export function generateProceduralTile(tx: number, ty: number): WorldTile {
  const key = `${tx},${ty}`;
  const originX = tx * TILE_SIZE_M;
  const originY = ty * TILE_SIZE_M;
  const centerLocal: [number, number] = [originX + TILE_SIZE_M / 2, originY + TILE_SIZE_M / 2];

  const groundBounds = {
    minX: originX, maxX: originX + TILE_SIZE_M,
    minY: originY, maxY: originY + TILE_SIZE_M,
  };

  if (overlapsRealTile(originX, originX + TILE_SIZE_M, originY, originY + TILE_SIZE_M)) {
    return { key: `proc:${key}`, origin: centerLocal, buildings: [], roads: [], isRealData: false, groundBounds };
  }

  const lonLat = toLonLat(centerLocal);
  const seed = hashString(`gaza-proc-tile:${key}`);
  const rng = mulberry32(seed);
  const buildings: BuildingNode[] = [];
  const roads: RoadSegment[] = [];

  if (isLand(lonLat.lon, lonLat.lat)) {
    // Urban density falls off with distance from the world origin (the
    // authored Gaza City core), clamped so it never fully empties out.
    const distFromCore = Math.hypot(centerLocal[0], centerLocal[1]);
    const density = Math.max(0.15, 1 - distFromCore / 9000);
    const count = Math.round(4 + density * 10);

    // One procedural street bisecting the cell, buildings set back from it.
    const streetY = originY + TILE_SIZE_M * (0.35 + rng() * 0.3);
    roads.push({
      id: `proc-road:${key}`,
      pathLocal: [
        [originX, streetY],
        [originX + TILE_SIZE_M, streetY],
      ],
      highway: "procedural",
      provenance: { classification: "PROCEDURAL_OBJECT", algorithm: "grid-street-v1", seed },
    });

    for (let i = 0; i < count; i++) {
      const bx = originX + 12 + rng() * (TILE_SIZE_M - 24);
      const by = originY + 12 + rng() * (TILE_SIZE_M - 24);
      if (Math.abs(by - streetY) < 6) continue;
      const w = 6 + rng() * 10;
      const d = 6 + rng() * 10;
      const h = (2 + Math.floor(rng() * 5)) * 3.2;
      const footprint: [number, number][] = [
        [bx - w / 2, by - d / 2],
        [bx + w / 2, by - d / 2],
        [bx + w / 2, by + d / 2],
        [bx - w / 2, by + d / 2],
        [bx - w / 2, by - d / 2],
      ];
      buildings.push({
        id: `proc-bldg:${key}:${i}`,
        footprintLocal: footprint,
        centroidLocal: [bx, by],
        heightM: h,
        areaM2: Math.round(w * d),
        name: null,
        provenance: {
          classification: "PROCEDURAL_OBJECT",
          algorithm: "seeded-block-fill-v1",
          seed,
          confidence: "illustrative",
          note: "No verified footprint here; generated from a deterministic seed to keep the strip continuously explorable.",
        },
      });
    }
  }

  return { key: `proc:${key}`, origin: centerLocal, buildings, roads, isRealData: false, groundBounds };
}

function toLonLat([x, y]: [number, number]) {
  const DEG2RAD = Math.PI / 180;
  const EARTH_RADIUS_M = 6378137;
  const lat0 = WORLD_ORIGIN.lat * DEG2RAD;
  return {
    lon: WORLD_ORIGIN.lon + x / (DEG2RAD * Math.cos(lat0) * EARTH_RADIUS_M),
    lat: WORLD_ORIGIN.lat + y / (DEG2RAD * EARTH_RADIUS_M),
  };
}

export { tileKeyForLocal, TILE_SIZE_M };
