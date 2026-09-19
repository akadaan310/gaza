import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useWorldStore } from "../store/worldStore";
import { TILE_SIZE_M, generateProceduralTile, getRealTiles, type WorldTile } from "./tiles";
import { TileMesh } from "./TileMesh";
import { GroundTile } from "./GroundTile";
import { Ocean } from "./Ocean";
import { Coastline } from "./Coastline";

const LOAD_RADIUS_CELLS = 2; // procedural cells around the player
const REAL_TILE_LOAD_RADIUS_M = 1200;
const REAL_TILE_UNLOAD_RADIUS_M = 1600; // > load radius, so tiles don't thrash at the boundary

const realTiles = getRealTiles();

export function GazaWorld() {
  const [proceduralTiles, setProceduralTiles] = useState<Map<string, WorldTile>>(new Map());
  const [realTileState, setRealTileState] = useState<Map<string, WorldTile>>(new Map());
  const loadingReal = useRef<Set<string>>(new Set());
  const lastCenterCell = useRef<string>("");

  useEffect(() => useWorldStore.getState().setLoadedProceduralTiles(proceduralTiles), [proceduralTiles]);
  useEffect(() => useWorldStore.getState().setLoadedRealTiles(realTileState), [realTileState]);

  useFrame(() => {
    const [px, py] = useWorldStore.getState().playerLocal;
    const centerTx = Math.floor(px / TILE_SIZE_M);
    const centerTy = Math.floor(py / TILE_SIZE_M);
    const centerKey = `${centerTx},${centerTy}`;
    if (centerKey !== lastCenterCell.current) {
      lastCenterCell.current = centerKey;
      setProceduralTiles((prev) => {
        const next = new Map<string, WorldTile>();
        for (let dx = -LOAD_RADIUS_CELLS; dx <= LOAD_RADIUS_CELLS; dx++) {
          for (let dy = -LOAD_RADIUS_CELLS; dy <= LOAD_RADIUS_CELLS; dy++) {
            const tx = centerTx + dx, ty = centerTy + dy;
            const key = `${tx},${ty}`;
            next.set(key, prev.get(key) ?? generateProceduralTile(tx, ty));
          }
        }
        return next;
      });
    }

    for (const rt of realTiles) {
      if (realTileState.has(rt.key) || loadingReal.current.has(rt.key)) continue;
      const d = Math.hypot(rt.centerLocal[0] - px, rt.centerLocal[1] - py);
      if (d > REAL_TILE_LOAD_RADIUS_M) continue;
      loadingReal.current.add(rt.key);
      rt.load().then((tile) => {
        setRealTileState((prev) => new Map(prev).set(rt.key, tile));
      });
    }
  });

  // Unload real tiles once far away, based on their actual bounds.
  useFrame(() => {
    const [px, py] = useWorldStore.getState().playerLocal;
    setRealTileState((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const [key, tile] of prev) {
        const d = Math.hypot(tile.origin[0] - px, tile.origin[1] - py);
        if (d > REAL_TILE_UNLOAD_RADIUS_M) {
          next.delete(key);
          loadingReal.current.delete(key);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  });

  useEffect(() => {
    // Eagerly warm the home tile so the first-person view isn't empty on load.
    realTiles[0]?.load().then((tile) => {
      loadingReal.current.add(realTiles[0].key);
      setRealTileState((prev) => new Map(prev).set(realTiles[0].key, tile));
    });
  }, []);

  return (
    <group>
      <Ocean />
      <Coastline />
      {Array.from(proceduralTiles.values()).map((tile) => (
        <group key={tile.key}>
          <GroundTile tile={tile} />
          <TileMesh tile={tile} />
        </group>
      ))}
      {Array.from(realTileState.values()).map((tile) => (
        <group key={tile.key}>
          <GroundTile tile={tile} />
          <TileMesh tile={tile} />
        </group>
      ))}
    </group>
  );
}

export { realTiles };
