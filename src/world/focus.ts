import type { WorldTile, BuildingNode } from "./tiles";

export function findNearestBuilding(
  tiles: Map<string, WorldTile>,
  point: [number, number]
): BuildingNode | null {
  let best: BuildingNode | null = null;
  let bestD = Infinity;
  for (const tile of tiles.values()) {
    for (const b of tile.buildings) {
      const d = (b.centroidLocal[0] - point[0]) ** 2 + (b.centroidLocal[1] - point[1]) ** 2;
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
  }
  return best;
}

export function findTileAt(
  point: [number, number],
  realTiles: Map<string, WorldTile>,
  proceduralTiles: Map<string, WorldTile>
): WorldTile | null {
  for (const tile of realTiles.values()) {
    const { minX, maxX, minY, maxY } = tile.groundBounds;
    if (point[0] >= minX && point[0] <= maxX && point[1] >= minY && point[1] <= maxY) return tile;
  }
  for (const tile of proceduralTiles.values()) {
    const { minX, maxX, minY, maxY } = tile.groundBounds;
    if (point[0] >= minX && point[0] <= maxX && point[1] >= minY && point[1] <= maxY) return tile;
  }
  return null;
}
