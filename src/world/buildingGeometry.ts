import * as THREE from "three";
import { mergeBufferGeometries } from "three-stdlib";
import type { BuildingNode } from "./tiles";

// Local (east, north) meters -> Three world (x, up, forward). North maps to
// -Z so the scene reads correctly from a standard top-down view.
export function toWorld(x: number, y: number, up = 0): [number, number, number] {
  return [x, up, -y];
}

const FACADE_PALETTE = [
  [0.78, 0.74, 0.63], // sand
  [0.72, 0.7, 0.66], // concrete
  [0.66, 0.63, 0.55], // weathered stone
  [0.8, 0.78, 0.7], // limestone
  [0.6, 0.58, 0.54], // grey concrete
];

function triangulateFootprint(footprint: [number, number][]): number[][] {
  const pts = footprint.slice(0, footprint.length - 1).map(([x, y]) => new THREE.Vector2(x, y));
  return THREE.ShapeUtils.triangulateShape(pts, []);
}

// Builds one merged mesh geometry for every building in a tile: side walls
// plus a flat roof, with a per-building color pulled from a small facade
// palette (seeded, so it's stable across re-renders) rather than one flat
// material — this alone does a lot for the "doesn't look like a spreadsheet
// of boxes" quality bar without needing textures.
export function buildTileBuildingsGeometry(buildings: BuildingNode[]): THREE.BufferGeometry | null {
  const geoms: THREE.BufferGeometry[] = [];

  for (const b of buildings) {
    const ring = b.footprintLocal;
    if (!ring || ring.length < 4) continue;

    const colorIdx = Math.abs(hash(b.id)) % FACADE_PALETTE.length;
    const [cr, cg, cb] = FACADE_PALETTE[colorIdx];

    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    const n = ring.length - 1; // last point duplicates first
    // Walls
    for (let i = 0; i < n; i++) {
      const [x0, y0] = ring[i];
      const [x1, y1] = ring[(i + 1) % n];
      const base = positions.length / 3;
      const verts = [
        toWorld(x0, y0, 0),
        toWorld(x1, y1, 0),
        toWorld(x1, y1, b.heightM),
        toWorld(x0, y0, b.heightM),
      ];
      for (const v of verts) positions.push(...v);
      const shade = 0.85 + 0.15 * ((i % 3) / 3);
      for (let k = 0; k < 4; k++) colors.push(cr * shade, cg * shade, cb * shade);
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }

    // Roof
    const roofTris = triangulateFootprint(ring);
    const roofBase = positions.length / 3;
    for (let i = 0; i < n; i++) {
      const [x, y] = ring[i];
      positions.push(...toWorld(x, y, b.heightM));
      colors.push(cr * 1.05, cg * 1.05, cb * 1.05);
    }
    for (const [a, bI, c] of roofTris) {
      indices.push(roofBase + a, roofBase + bI, roofBase + c);
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    geoms.push(geom);
  }

  if (geoms.length === 0) return null;
  return mergeBufferGeometries(geoms, false);
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h;
}
