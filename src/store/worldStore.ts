import { create } from "zustand";
import type { Provenance } from "../data/provenance";
import type { WorldTile } from "../world/tiles";

export interface FocusInfo {
  id: string;
  label: string;
  provenance: Provenance;
  extra?: Record<string, string | number>;
}

interface WorldState {
  playerLocal: [number, number]; // x east, y north, meters from world origin
  playerHeadingRad: number;
  playerWorldPos: [number, number, number]; // raw three.js camera position, valid in any scene
  introDismissed: boolean;
  researchMode: boolean;
  inInterstellar: boolean;
  discovered: Set<string>;
  focus: FocusInfo | null;
  timeOfDay: number; // 0..1, 0 = midnight, 0.5 = noon
  commandCenterOpen: boolean;
  activeRelation: { rootId: string; buildingId: string } | null;
  pointerLocked: boolean;
  loadedRealTiles: Map<string, WorldTile>;
  loadedProceduralTiles: Map<string, WorldTile>;
  interactPulse: number;
  autoNav: {
    label: string;
    path: [number, number][];
    targetIndex: number;
  } | null;

  setPlayerLocal: (p: [number, number], heading: number) => void;
  setPlayerWorldPos: (p: [number, number, number]) => void;
  dismissIntro: () => void;
  toggleResearchMode: () => void;
  setInInterstellar: (v: boolean) => void;
  discover: (id: string) => void;
  setFocus: (f: FocusInfo | null) => void;
  tickTime: (deltaHours: number) => void;
  setCommandCenterOpen: (v: boolean) => void;
  setActiveRelation: (r: { rootId: string; buildingId: string } | null) => void;
  setPointerLocked: (v: boolean) => void;
  setLoadedRealTiles: (m: Map<string, WorldTile>) => void;
  setLoadedProceduralTiles: (m: Map<string, WorldTile>) => void;
  triggerInteract: () => void;
  startAutoNav: (label: string, path: [number, number][]) => void;
  advanceAutoNav: () => void;
  cancelAutoNav: () => void;
}

export const useWorldStore = create<WorldState>((set) => ({
  playerLocal: [0, -30],
  playerHeadingRad: 0,
  playerWorldPos: [0, 1.75, 30],
  introDismissed: false,
  researchMode: false,
  inInterstellar: false,
  discovered: new Set(),
  focus: null,
  timeOfDay: 0.62,
  commandCenterOpen: false,
  activeRelation: null,
  pointerLocked: false,
  loadedRealTiles: new Map(),
  loadedProceduralTiles: new Map(),
  interactPulse: 0,
  autoNav: null,

  setPlayerLocal: (p, heading) => set({ playerLocal: p, playerHeadingRad: heading }),
  setPlayerWorldPos: (p) => set({ playerWorldPos: p }),
  dismissIntro: () => set({ introDismissed: true }),
  toggleResearchMode: () => set((s) => ({ researchMode: !s.researchMode })),
  setInInterstellar: (v) => set({ inInterstellar: v }),
  discover: (id) =>
    set((s) => {
      if (s.discovered.has(id)) return {};
      const next = new Set(s.discovered);
      next.add(id);
      return { discovered: next };
    }),
  setFocus: (f) => set({ focus: f }),
  tickTime: (deltaHours) =>
    set((s) => ({ timeOfDay: (s.timeOfDay + deltaHours / 24) % 1 })),
  setCommandCenterOpen: (v) => set({ commandCenterOpen: v }),
  setActiveRelation: (r) => set({ activeRelation: r }),
  setPointerLocked: (v) => set({ pointerLocked: v }),
  setLoadedRealTiles: (m) => set({ loadedRealTiles: m }),
  setLoadedProceduralTiles: (m) => set({ loadedProceduralTiles: m }),
  triggerInteract: () => set((s) => ({ interactPulse: s.interactPulse + 1 })),
  startAutoNav: (label, path) => set({ autoNav: { label, path, targetIndex: 1 } }),
  advanceAutoNav: () =>
    set((s) => {
      if (!s.autoNav) return {};
      const nextIndex = s.autoNav.targetIndex + 1;
      if (nextIndex >= s.autoNav.path.length) return { autoNav: null };
      return { autoNav: { ...s.autoNav, targetIndex: nextIndex } };
    }),
  cancelAutoNav: () => set({ autoNav: null }),
}));
