import * as THREE from "three";
import { computeRootRecurrence } from "../quran/data";

// One color per recurring root, assigned by the root's position in the
// (deterministic, sorted) recurrence table — every consumer (GuideField,
// the activation beams/paths, InterstellarScene) calls this instead of
// deriving its own index, so a building's color is the same wherever it's
// drawn rather than three independently "close enough" computations.
const PALETTE = ["#8fd0ff", "#c9a2f5", "#f5d98f", "#7fe0c0", "#f28fae", "#ffb37f"];

let rootOrder: string[] | null = null;
function getRootOrder(): string[] {
  if (!rootOrder) rootOrder = computeRootRecurrence().map((r) => r.root);
  return rootOrder;
}

export function colorForRoot(root: string): THREE.Color {
  const order = getRootOrder();
  const idx = order.indexOf(root);
  return new THREE.Color(PALETTE[(idx >= 0 ? idx : 0) % PALETTE.length]);
}
