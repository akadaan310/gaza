// Robust auto-navigation: builds a walkable graph from every loaded road
// (real OSM streets + procedural streets alike), snapping near-coincident
// endpoints together so real and procedural segments actually connect.
// Pathfinding is plain Dijkstra over that graph. If a start or end point
// can't be snapped onto the graph (nothing loaded nearby, or the graph is
// disconnected), navigation never simply fails — it falls back to a direct
// line so "auto-walk" always produces *a* route, just a cruder one.
import type { WorldTile } from "./tiles";

const SNAP_GRID_M = 3; // merge road vertices within this tolerance into one graph node
const STITCH_RADIUS_M = 12; // connect otherwise-disconnected endpoints within this distance
const MAX_SNAP_TO_GRAPH_M = 90; // how far a start/end point may be from the nearest graph node

interface GraphNode {
  id: string;
  pos: [number, number];
  neighbors: Map<string, number>; // neighbor id -> edge weight (meters)
}

export interface NavGraph {
  nodes: Map<string, GraphNode>;
}

function keyFor(x: number, y: number): string {
  return `${Math.round(x / SNAP_GRID_M)},${Math.round(y / SNAP_GRID_M)}`;
}

function getOrCreateNode(graph: NavGraph, x: number, y: number): GraphNode {
  const key = keyFor(x, y);
  let node = graph.nodes.get(key);
  if (!node) {
    node = { id: key, pos: [x, y], neighbors: new Map() };
    graph.nodes.set(key, node);
  }
  return node;
}

function connect(a: GraphNode, b: GraphNode) {
  const d = Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1]);
  if (d === 0) return;
  const existing = a.neighbors.get(b.id);
  if (existing === undefined || d < existing) {
    a.neighbors.set(b.id, d);
    b.neighbors.set(a.id, d);
  }
}

export function buildNavGraph(tiles: Iterable<WorldTile>): NavGraph {
  const graph: NavGraph = { nodes: new Map() };

  for (const tile of tiles) {
    for (const road of tile.roads) {
      const pts = road.pathLocal;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = getOrCreateNode(graph, pts[i][0], pts[i][1]);
        const b = getOrCreateNode(graph, pts[i + 1][0], pts[i + 1][1]);
        connect(a, b);
      }
    }
  }

  // Stitch endpoints that are close but didn't snap to the same grid cell
  // (common where real OSM data and procedural streets meet, or where two
  // OSM ways share an intersection without exactly matching coordinates).
  const nodeList = Array.from(graph.nodes.values());
  for (let i = 0; i < nodeList.length; i++) {
    for (let j = i + 1; j < nodeList.length; j++) {
      const a = nodeList[i], b = nodeList[j];
      if (a.neighbors.has(b.id)) continue;
      const d = Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1]);
      if (d > 0 && d <= STITCH_RADIUS_M) connect(a, b);
    }
  }

  return graph;
}

function nearestNode(graph: NavGraph, point: [number, number]): GraphNode | null {
  let best: GraphNode | null = null;
  let bestD = Infinity;
  for (const node of graph.nodes.values()) {
    const d = Math.hypot(node.pos[0] - point[0], node.pos[1] - point[1]);
    if (d < bestD) {
      bestD = d;
      best = node;
    }
  }
  if (!best || bestD > MAX_SNAP_TO_GRAPH_M) return null;
  return best;
}

function dijkstra(graph: NavGraph, startId: string, endId: string): string[] | null {
  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const visited = new Set<string>();
  dist.set(startId, 0);

  // Small graphs (a few hundred nodes) — a plain O(n^2) scan for the min
  // is simpler than a heap and fast enough here.
  while (visited.size < graph.nodes.size) {
    let u: string | null = null;
    let uDist = Infinity;
    for (const [id, d] of dist) {
      if (!visited.has(id) && d < uDist) {
        uDist = d;
        u = id;
      }
    }
    if (u === null) break;
    if (u === endId) break;
    visited.add(u);
    const node = graph.nodes.get(u)!;
    for (const [vId, w] of node.neighbors) {
      if (visited.has(vId)) continue;
      const alt = uDist + w;
      if (alt < (dist.get(vId) ?? Infinity)) {
        dist.set(vId, alt);
        prev.set(vId, u);
      }
    }
  }

  if (!dist.has(endId)) return null;
  const path: string[] = [endId];
  let cur = endId;
  while (cur !== startId) {
    const p = prev.get(cur);
    if (!p) return null;
    path.push(p);
    cur = p;
  }
  path.reverse();
  return path;
}

// Always returns a usable route. Prefers the real road network; falls back
// to a direct line whenever the graph can't cover the request, so callers
// never have to special-case "no path found".
export function findRoute(
  graph: NavGraph,
  start: [number, number],
  end: [number, number]
): [number, number][] {
  const startNode = nearestNode(graph, start);
  const endNode = nearestNode(graph, end);

  if (!startNode || !endNode) return [start, end];

  const path = dijkstra(graph, startNode.id, endNode.id);
  if (!path) return [start, end];

  const waypoints: [number, number][] = [start];
  for (const id of path) waypoints.push(graph.nodes.get(id)!.pos);
  waypoints.push(end);

  // Drop redundant near-duplicate points (e.g. start snapping right onto
  // the first graph node) so the walker doesn't stall on a ~0m leg.
  return waypoints.filter((p, i) => {
    if (i === 0) return true;
    const prev2 = waypoints[i - 1];
    return Math.hypot(p[0] - prev2[0], p[1] - prev2[1]) > 0.5;
  });
}
