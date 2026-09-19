import { useWorldStore } from "../store/worldStore";
import { buildNavGraph, findRoute } from "./navGraph";

// The one entry point every "go here" affordance in the UI calls. Builds
// the walkable graph from whatever roads are currently loaded and always
// hands back a route (graph-based when possible, straight-line otherwise —
// see navGraph's findRoute), so this can never leave a destination
// unreachable from the caller's point of view.
export function navigateTo(label: string, target: [number, number]) {
  const state = useWorldStore.getState();
  const tiles = [...state.loadedRealTiles.values(), ...state.loadedProceduralTiles.values()];
  const graph = buildNavGraph(tiles);
  const path = findRoute(graph, state.playerLocal, target);
  state.startAutoNav(label, path);
}
