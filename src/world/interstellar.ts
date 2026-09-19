// World B: Interstellar. The one transformation the whole "bridge" concept
// rests on: EARTH POSITION -> RELATIONAL COMPUTATION -> INTERSTELLAR POSITION.
//
// This is deterministic (same node id + centroid always yields the same
// star position) and it is *relational*, not a bare rescale: a node's
// interstellar direction is derived from its real bearing/distance from
// the world origin (so Gaza's actual geography still shapes the sky),
// folded through a per-node hash (so two adjacent buildings don't collapse
// onto the same star) and grouped into constellations by a spatial bucket
// (so nearby Earth structures cluster in the sky too).
import { hashString, mulberry32 } from "./geo";

export interface InterstellarNode {
  id: string;
  position: [number, number, number]; // scene units, roughly "light-seconds"
  constellationId: string;
  magnitude: number; // 0..1, drives star brightness/size
}

const CONSTELLATION_CELL_M = 220;

export function constellationIdFor(localX: number, localY: number): string {
  const cx = Math.floor(localX / CONSTELLATION_CELL_M);
  const cy = Math.floor(localY / CONSTELLATION_CELL_M);
  return `const:${cx},${cy}`;
}

export function earthToInterstellar(
  id: string,
  localX: number,
  localY: number,
  mass = 1
): InterstellarNode {
  const seed = hashString(id);
  const rng = mulberry32(seed);

  // Real bearing/distance from the world origin (Palestine Square) —
  // this is the "relational computation" carrying Earth geography into
  // the sky rather than inventing a position from nothing.
  const bearing = Math.atan2(localY, localX);
  const distance = Math.hypot(localX, localY);

  // Non-linear "unfolding" of the local plane onto a celestial sphere:
  // distance drives polar angle (near = high in the sky, far = toward the
  // horizon of the constellation dome), bearing drives azimuth, and the
  // per-id hash perturbs both so the mapping isn't a literal rescale.
  const jitterTheta = (rng() - 0.5) * 0.6;
  const jitterPhi = (rng() - 0.5) * 0.6;
  const theta = bearing + jitterTheta; // azimuth
  const phi = Math.min(1, distance / 3000) * (Math.PI / 2.4) + jitterPhi * 0.3; // polar

  const baseRadius = 260 + Math.min(400, distance * 0.35);
  const massBoost = Math.log2(1 + Math.max(0, mass)) * 18;
  const radius = baseRadius + massBoost + rng() * 60;

  const x = radius * Math.sin(phi) * Math.cos(theta);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return {
    id,
    position: [x, y, z],
    constellationId: constellationIdFor(localX, localY),
    magnitude: Math.min(1, 0.25 + massBoost / 80 + rng() * 0.2),
  };
}

// Deterministic nearest-neighbor edges within a constellation, used to
// draw the connecting lines that make a cluster of stars read as a
// constellation rather than a scatter of points.
export function buildConstellationEdges(
  nodes: InterstellarNode[]
): Array<[string, string]> {
  const byConstellation = new Map<string, InterstellarNode[]>();
  for (const n of nodes) {
    const list = byConstellation.get(n.constellationId) ?? [];
    list.push(n);
    byConstellation.set(n.constellationId, list);
  }
  const edges: Array<[string, string]> = [];
  for (const group of byConstellation.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      let bestJ = -1;
      let bestD = Infinity;
      for (let j = 0; j < group.length; j++) {
        if (i === j) continue;
        const [ax, ay, az] = group[i].position;
        const [bx, by, bz] = group[j].position;
        const d = (ax - bx) ** 2 + (ay - by) ** 2 + (az - bz) ** 2;
        if (d < bestD) {
          bestD = d;
          bestJ = j;
        }
      }
      if (bestJ >= 0) {
        const a = group[i].id, b = group[bestJ].id;
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        if (!edges.some(([x, y]) => (x < y ? `${x}|${y}` : `${y}|${x}`) === key)) {
          edges.push([a, b]);
        }
      }
    }
  }
  return edges;
}
