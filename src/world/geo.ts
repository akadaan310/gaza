// World A: Earth. Converts real lon/lat into a local East-North-Up (ENU)
// meter frame centered on an origin, and covers the whole Gaza Strip with
// a deterministic tile grid so any position on the strip resolves to a
// well-defined tile, whether or not we hold real data for it.

export interface LonLat {
  lon: number;
  lat: number;
}

// Origin for the whole world's local coordinate frame: Palestine Square,
// Gaza City — the first-authored "bridge port" location.
export const WORLD_ORIGIN: LonLat = { lon: 34.4616, lat: 31.5063 };

const EARTH_RADIUS_M = 6378137;
const DEG2RAD = Math.PI / 180;

// Equirectangular local projection: accurate to well under 1% error across
// the ~45km extent of the Gaza Strip, adequate for a walkable/local frame.
export function lonLatToLocal(p: LonLat, origin: LonLat = WORLD_ORIGIN): [number, number] {
  const lat0 = origin.lat * DEG2RAD;
  const x = (p.lon - origin.lon) * DEG2RAD * Math.cos(lat0) * EARTH_RADIUS_M;
  const y = (p.lat - origin.lat) * DEG2RAD * EARTH_RADIUS_M;
  return [x, y]; // meters east, meters north
}

export function localToLonLat([x, y]: [number, number], origin: LonLat = WORLD_ORIGIN): LonLat {
  const lat0 = origin.lat * DEG2RAD;
  const lon = origin.lon + x / (DEG2RAD * Math.cos(lat0) * EARTH_RADIUS_M);
  const lat = origin.lat + y / (DEG2RAD * EARTH_RADIUS_M);
  return { lon, lat };
}

// The Gaza Strip's real extent (approx.), used to bound the tile grid and
// to fade procedural land into sea/desert honestly at the real edges.
export const GAZA_STRIP_BOUNDS = {
  minLon: 34.2151,
  maxLon: 34.5765,
  minLat: 31.2201,
  maxLat: 31.5949,
};

export const TILE_SIZE_M = 480; // ~ one fetched tile's edge length

export function tileKeyForLocal(x: number, y: number): string {
  const tx = Math.floor(x / TILE_SIZE_M);
  const ty = Math.floor(y / TILE_SIZE_M);
  return `${tx},${ty}`;
}

export function tileOriginLocal(tx: number, ty: number): [number, number] {
  return [tx * TILE_SIZE_M, ty * TILE_SIZE_M];
}

// A stable 32-bit hash for deterministic per-tile procedural seeding.
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// mulberry32 deterministic PRNG — same seed always produces the same
// sequence, which is what makes procedural tiles reproducible rather than
// random noise dressed up as content.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
