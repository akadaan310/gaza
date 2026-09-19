// The real Gaza coastline (OpenStreetMap), used both to render the
// shoreline itself and as ground truth for the procedural land/sea test:
// no procedural building may be generated in the sea.
import coastlineData from "../../public/data/coastline.json";
import { lonLatToLocal, type LonLat } from "./geo";

interface CoastlineSegment {
  id: string;
  path: [number, number][]; // [lon, lat]
}

const segments: CoastlineSegment[] = coastlineData.segments.map((s) => ({
  id: s.id,
  path: s.path.map(([lon, lat]) => [lon, lat] as [number, number]),
}));

// Flatten and sort all coastline points by latitude descending so we can
// interpolate "coastline longitude at a given latitude" — valid because
// Gaza's coast runs roughly north-south with the sea to the west.
const points: LonLat[] = segments
  .flatMap((s) => s.path.map(([lon, lat]) => ({ lon, lat })))
  .sort((a, b) => b.lat - a.lat);

export function coastlineLonAtLat(lat: number): number {
  if (points.length === 0) return 34.45;
  if (lat >= points[0].lat) return points[0].lon;
  if (lat <= points[points.length - 1].lat) return points[points.length - 1].lon;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    if (lat <= a.lat && lat >= b.lat) {
      const t = a.lat === b.lat ? 0 : (a.lat - lat) / (a.lat - b.lat);
      return a.lon + (b.lon - a.lon) * t;
    }
  }
  return points[points.length - 1].lon;
}

export function isLand(lon: number, lat: number): boolean {
  return lon > coastlineLonAtLat(lat) + 0.001; // small margin inland of the line
}

export function distanceToCoastlineDeg(lon: number, lat: number): number {
  return lon - coastlineLonAtLat(lat);
}

export function coastlineLocalPolylines(): Array<[number, number][]> {
  return segments.map((s) => s.path.map(([lon, lat]) => lonLatToLocal({ lon, lat })));
}
