import { useMemo } from "react";
import * as THREE from "three";
import type { WorldTile } from "./tiles";
import { toWorld } from "./buildingGeometry";
import { localToLonLat } from "./geo";
import { isLand } from "./coastline";

// Ground for procedural tiles only — real tiles sit on the same shared land
// plane (see Coastline/Ocean split) plus this tint pass gives each cell a
// little natural variation instead of one dead-flat color.
export function GroundTile({ tile }: { tile: WorldTile }) {
  const { minX, maxX, minY, maxY } = tile.groundBounds;
  const width = maxX - minX;
  const depth = maxY - minY;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  const land = useMemo(() => {
    const { lon, lat } = localToLonLat([cx, cy]);
    return isLand(lon, lat);
  }, [cx, cy]);

  if (!land) return null;

  const seed = ((Math.abs(minX) * 928371 + Math.abs(minY) * 71317) % 1000) / 1000;
  const hue = 0.09 + seed * 0.015;
  const color = new THREE.Color().setHSL(hue, 0.28, 0.42 + seed * 0.05);

  return (
    <mesh position={toWorld(cx, cy, -0.02)} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial color={color} roughness={1} metalness={0} />
    </mesh>
  );
}
