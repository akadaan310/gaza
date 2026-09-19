import { useMemo } from "react";
import type { WorldTile } from "./tiles";
import { buildTileBuildingsGeometry } from "./buildingGeometry";
import { buildRoadsGeometry } from "./roadGeometry";

export function TileMesh({ tile }: { tile: WorldTile }) {
  const buildingsGeometry = useMemo(() => buildTileBuildingsGeometry(tile.buildings), [tile]);
  const roadsGeometry = useMemo(() => buildRoadsGeometry(tile.roads), [tile]);

  return (
    <group>
      {buildingsGeometry && (
        <mesh geometry={buildingsGeometry} castShadow receiveShadow>
          <meshStandardMaterial vertexColors roughness={0.85} metalness={0.02} />
        </mesh>
      )}
      {roadsGeometry && (
        <mesh geometry={roadsGeometry} receiveShadow>
          <meshStandardMaterial color="#2b2b29" roughness={0.95} metalness={0} />
        </mesh>
      )}
    </group>
  );
}
