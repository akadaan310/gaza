import { create } from "zustand";
import type { Provenance } from "../data/provenance";
import type { WorldTile } from "../world/tiles";

export interface FocusInfo {
  id: string;
  label: string;
  provenance: Provenance;
  extra?: Record<string, string | number>;
}

// A guide's relation is activated once, by proximity, and then persists —
// including after the tile it lives on unloads — because the point is the
// growing web of encountered relations, not a transient hover state. Each
// record carries everything needed to redraw its beam/edge without looking
// the building back up.
export interface GuideActivation {
  buildingId: string;
  rootId: string;
  worldPos: [number, number, number];
  direction: [number, number, number]; // unit vector; the same Earth->Interstellar bearing InterstellarScene places this building's star along
}

export interface RelationEdge {
  rootId: string;
  a: [number, number, number];
  b: [number, number, number];
}

interface WorldState {
  playerLocal: [number, number]; // x east, y north, meters from world origin
  playerHeadingRad: number;
  playerWorldPos: [number, number, number]; // raw three.js camera position, valid in any scene
  introDismissed: boolean;
  researchMode: boolean;
  inInterstellar: boolean;
  discovered: Set<string>;
  activatedGuides: Map<string, GuideActivation>;
  relationEdges: RelationEdge[];
  focus: FocusInfo | null;
  timeOfDay: number; // 0..1, 0 = midnight, 0.5 = noon
  commandCenterOpen: boolean;
  activeRelation: { rootId: string; buildingId: string } | null;
  pointerLocked: boolean;
  perfTier: "high" | "low";
  teleportRequest: [number, number] | null;
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
  activateGuide: (record: GuideActivation) => void;
  setFocus: (f: FocusInfo | null) => void;
  tickTime: (deltaHours: number) => void;
  setCommandCenterOpen: (v: boolean) => void;
  setActiveRelation: (r: { rootId: string; buildingId: string } | null) => void;
  setPointerLocked: (v: boolean) => void;
  setPerfTier: (t: "high" | "low") => void;
  requestTeleport: (p: [number, number]) => void;
  clearTeleportRequest: () => void;
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
  activatedGuides: new Map(),
  relationEdges: [],
  focus: null,
  timeOfDay: 0.62,
  commandCenterOpen: false,
  activeRelation: null,
  pointerLocked: false,
  perfTier: "high",
  teleportRequest: null,
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
  activateGuide: (record) =>
    set((s) => {
      if (s.activatedGuides.has(record.buildingId)) return {};

      // Link to the nearest already-activated guide sharing the same root —
      // this is what turns individually-encountered buildings into a
      // visible, growing relational graph rather than isolated pins.
      let nearestId: string | null = null;
      let nearestD = Infinity;
      for (const other of s.activatedGuides.values()) {
        if (other.rootId !== record.rootId) continue;
        const d = Math.hypot(other.worldPos[0] - record.worldPos[0], other.worldPos[2] - record.worldPos[2]);
        if (d < nearestD) {
          nearestD = d;
          nearestId = other.buildingId;
        }
      }

      const nextGuides = new Map(s.activatedGuides);
      nextGuides.set(record.buildingId, record);

      let nextEdges = s.relationEdges;
      if (nearestId) {
        const other = s.activatedGuides.get(nearestId)!;
        nextEdges = [...s.relationEdges, { rootId: record.rootId, a: other.worldPos, b: record.worldPos }];
      }

      return { activatedGuides: nextGuides, relationEdges: nextEdges };
    }),
  setFocus: (f) => set({ focus: f }),
  tickTime: (deltaHours) =>
    set((s) => ({ timeOfDay: (s.timeOfDay + deltaHours / 24) % 1 })),
  setCommandCenterOpen: (v) => set({ commandCenterOpen: v }),
  setActiveRelation: (r) => set({ activeRelation: r }),
  setPointerLocked: (v) => set({ pointerLocked: v }),
  setPerfTier: (t) => set({ perfTier: t }),
  requestTeleport: (p) => set({ teleportRequest: p }),
  clearTeleportRequest: () => set({ teleportRequest: null }),
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
