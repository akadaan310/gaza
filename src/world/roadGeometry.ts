import * as THREE from "three";
import { mergeBufferGeometries } from "three-stdlib";
import type { RoadSegment } from "./tiles";
import { toWorld } from "./buildingGeometry";

const WIDTH_BY_TYPE: Record<string, number> = {
  primary: 9,
  secondary: 7.5,
  tertiary: 6.5,
  residential: 5.5,
  procedural: 5,
};

// Flat ribbon quads laid slightly above the ground plane so they don't
// z-fight, widened per highway class — reads as real streets rather than
// wireframe center-lines.
export function buildRoadsGeometry(roads: RoadSegment[]): THREE.BufferGeometry | null {
  const geoms: THREE.BufferGeometry[] = [];
  for (const r of roads) {
    const width = WIDTH_BY_TYPE[r.highway] ?? 5;
    const pts = r.pathLocal;
    if (pts.length < 2) continue;

    const positions: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const dx = x1 - x0, dy = y1 - y0;
      const len = Math.hypot(dx, dy) || 1;
      const nx = (-dy / len) * (width / 2);
      const ny = (dx / len) * (width / 2);
      const base = positions.length / 3;
      positions.push(
        ...toWorld(x0 + nx, y0 + ny, 0.05),
        ...toWorld(x0 - nx, y0 - ny, 0.05),
        ...toWorld(x1 - nx, y1 - ny, 0.05),
        ...toWorld(x1 + nx, y1 + ny, 0.05)
      );
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    geoms.push(geom);
  }
  if (geoms.length === 0) return null;
  return mergeBufferGeometries(geoms, false);
}
