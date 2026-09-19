import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useWorldStore } from "../store/worldStore";
import { toWorld } from "./buildingGeometry";
import { rootForNodeId, computeRootRecurrence } from "../quran/data";
import { earthToInterstellar } from "./interstellar";
import { colorForRoot } from "./rootColors";
import type { BuildingNode } from "./tiles";
import { hashString } from "./geo";

// Scales the single scripted Guide into the "GAZA GUIDES" system proper:
// every real (verified or height-derived) building becomes a manifestation
// — a light, not an NPC standing around — that can be approached. One
// InstancedMesh carries all of them (thousands, once a couple of real
// tiles are loaded) for a single draw call; only manifestations within
// ANIMATE_RADIUS_M are animated per frame. You only ever *engage* the one
// you're nearest to — approaching it computes and permanently activates
// its relation (see worldStore.activateGuide), it doesn't fire randomly.
const MAX_INSTANCES = 6000;
const ANIMATE_RADIUS_M = 150;
const DISCOVER_RADIUS_M = 9;
const BASE_SCALE = 0.85;
const GLOW_GAIN = 2.4; // pushes colors past 1.0 so Bloom picks them up as light, not flat color

interface GuideEntry {
  building: BuildingNode;
  basePos: THREE.Vector3;
  phase: number;
  color: THREE.Color;
}

function directionToAzEl([x, y, z]: [number, number, number]): { az: number; el: number } {
  const az = (Math.atan2(x, -z) * (180 / Math.PI) + 360) % 360;
  const el = Math.asin(THREE.MathUtils.clamp(y, -1, 1)) * (180 / Math.PI);
  return { az, el };
}

export function GuideField() {
  const realTiles = useWorldStore((s) => s.loadedRealTiles);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const nearestRef = useRef<string | null>(null);
  const lastPulse = useRef(useWorldStore.getState().interactPulse);

  const entries: GuideEntry[] = useMemo(() => {
    const recurring = computeRootRecurrence();
    const list: GuideEntry[] = [];
    for (const tile of realTiles.values()) {
      for (const b of tile.buildings) {
        if (list.length >= MAX_INSTANCES) break;
        const [wx, wy, wz] = toWorld(b.centroidLocal[0], b.centroidLocal[1], b.heightM + 2);
        // One deterministic root per building — not per render, not random.
        const rootIdx = recurring.length ? hashString(b.id) % recurring.length : 0;
        const root = recurring[rootIdx];
        list.push({
          building: b,
          basePos: new THREE.Vector3(wx, wy, wz),
          phase: (hashString(b.id + ":phase") % 6283) / 1000,
          color: root ? colorForRoot(root.root).clone().multiplyScalar(GLOW_GAIN) : new THREE.Color(1, 1, 1),
        });
      }
    }
    return list;
  }, [realTiles]);

  // (Re)lay out every instance whenever the loaded building set changes.
  // Cheap: only fires on tile load/unload, not per frame.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    entries.forEach((e, i) => {
      dummy.position.copy(e.basePos);
      dummy.scale.setScalar(BASE_SCALE);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, e.color);
    });
    for (let i = entries.length; i < MAX_INSTANCES; i++) {
      dummy.position.set(0, -50000, 0);
      dummy.scale.setScalar(0.0001);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.count = Math.max(entries.length, 1);
  }, [entries, dummy]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh || entries.length === 0) return;
    const state = useWorldStore.getState();
    const [px, py] = state.playerLocal;
    const t = clock.elapsedTime;

    let nearestIdx = -1;
    let nearestD = Infinity;
    let touched = false;

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const dx = e.building.centroidLocal[0] - px;
      const dy = e.building.centroidLocal[1] - py;
      const d = Math.hypot(dx, dy);
      if (d < nearestD) {
        nearestD = d;
        nearestIdx = i;
      }
      if (d > ANIMATE_RADIUS_M) continue;
      touched = true;
      const bob = Math.sin(t * 1.6 + e.phase) * 0.35;
      const pulse = BASE_SCALE * (0.85 + 0.2 * Math.sin(t * 2.1 + e.phase));
      dummy.position.set(e.basePos.x, e.basePos.y + bob, e.basePos.z);
      dummy.scale.setScalar(pulse);
      dummy.rotation.set(0, t * 0.5 + e.phase, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    if (touched) mesh.instanceMatrix.needsUpdate = true;

    if (nearestIdx >= 0 && nearestD < DISCOVER_RADIUS_M) {
      const e = entries[nearestIdx];
      const root = rootForNodeId(e.building.id);
      const node = earthToInterstellar(
        e.building.id,
        e.building.centroidLocal[0],
        e.building.centroidLocal[1],
        e.building.areaM2
      );
      const direction = new THREE.Vector3(...node.position).normalize();
      const directionTuple: [number, number, number] = [direction.x, direction.y, direction.z];

      if (nearestRef.current !== e.building.id) {
        nearestRef.current = e.building.id;
        state.activateGuide({
          buildingId: e.building.id,
          rootId: root.root,
          worldPos: [e.basePos.x, e.basePos.y, e.basePos.z],
          direction: directionTuple,
        });
      }

      const { az, el } = directionToAzEl(directionTuple);
      state.setFocus({
        id: `guide-node:${e.building.id}`,
        label: e.building.name ?? "Interstellar Guide",
        provenance: {
          classification: "SYMBOLIC_OBJECT",
          algorithm: "earthToInterstellar (shared with the star field beyond the portal)",
          note: `Manifestation anchored to a real structure — resonates with the recurring root ${root.root}.`,
        },
        extra: {
          root: root.root,
          recursIn: `${root.count} ayat of al-Fātiḥah`,
          coordinate: `az ${az.toFixed(0)}° · el ${el.toFixed(0)}°`,
        },
      });

      const pulse = state.interactPulse;
      if (pulse !== lastPulse.current) {
        lastPulse.current = pulse;
        state.setActiveRelation({ rootId: root.root, buildingId: e.building.id });
      }
    } else {
      nearestRef.current = null;
    }
  });

  if (entries.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, MAX_INSTANCES]}
      frustumCulled={false}
    >
      <icosahedronGeometry args={[0.42, 0]} />
      <meshBasicMaterial vertexColors toneMapped />
    </instancedMesh>
  );
}
