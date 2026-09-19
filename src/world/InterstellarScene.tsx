import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useWorldStore } from "../store/worldStore";
import { earthToInterstellar, buildConstellationEdges, type InterstellarNode } from "./interstellar";
import { AL_FATIHA, computeRootRecurrence, type RootRecurrence } from "../quran/data";

const RETURN_PORTAL_POS = new THREE.Vector3(0, 0, 60);
const RETURN_RADIUS = 10;

export function InterstellarScene() {
  const { camera } = useThree();
  const realTiles = useWorldStore((s) => s.loadedRealTiles);
  const activeRelation = useWorldStore((s) => s.activeRelation);
  const [nearReturn, setNearReturn] = useState(false);
  const lastPulse = useRef(useWorldStore.getState().interactPulse);
  const groupRef = useRef<THREE.Group>(null);

  const { nodes, edges } = useMemo(() => {
    const list: InterstellarNode[] = [];
    for (const tile of realTiles.values()) {
      for (const b of tile.buildings) {
        list.push(earthToInterstellar(b.id, b.centroidLocal[0], b.centroidLocal[1], b.areaM2));
      }
    }
    return { nodes: list, edges: buildConstellationEdges(list) };
  }, [realTiles]);

  const positionById = useMemo(() => {
    const m = new Map<string, [number, number, number]>();
    for (const n of nodes) m.set(n.id, n.position);
    return m;
  }, [nodes]);

  const originNode = activeRelation ? positionById.get(activeRelation.buildingId) : undefined;

  const recurrence: RootRecurrence | null = useMemo(() => {
    if (!activeRelation) return null;
    return computeRootRecurrence().find((r) => r.root === activeRelation.rootId) ?? null;
  }, [activeRelation]);

  useEffect(() => {
    const vantage = originNode
      ? new THREE.Vector3(originNode[0] * 0.3, Math.max(20, originNode[1] * 0.3), originNode[2] * 0.3 + 80)
      : new THREE.Vector3(0, 30, 120);
    camera.position.copy(vantage);
    camera.lookAt(originNode ? new THREE.Vector3(...originNode) : new THREE.Vector3(0, 40, 0));
  }, [camera, originNode]);

  const edgeGeometry = useMemo(() => {
    const positions: number[] = [];
    for (const [a, b] of edges) {
      const pa = positionById.get(a);
      const pb = positionById.get(b);
      if (!pa || !pb) continue;
      positions.push(...pa, ...pb);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return geom;
  }, [edges, positionById]);

  useFrame(() => {
    const [px, py, pz] = useWorldStore.getState().playerWorldPos;
    const d = new THREE.Vector3(px, py, pz).distanceTo(RETURN_PORTAL_POS);
    setNearReturn(d < RETURN_RADIUS);
    const pulse = useWorldStore.getState().interactPulse;
    if (pulse !== lastPulse.current) {
      lastPulse.current = pulse;
      if (d < RETURN_RADIUS) {
        useWorldStore.getState().setInInterstellar(false);
      }
    }
    if (groupRef.current) groupRef.current.rotation.y += 0.0006;
  });

  return (
    <group>
      <color attach="background" args={["#02030a"]} />
      <ambientLight intensity={0.4} color="#7a8cff" />
      <pointLight position={[0, 60, 0]} intensity={1.5} color="#c9a2f5" distance={800} />

      <group ref={groupRef}>
        <lineSegments geometry={edgeGeometry}>
          <lineBasicMaterial color="#5a6fd8" transparent opacity={0.35} />
        </lineSegments>

        {nodes.map((n) => {
          const isOrigin = activeRelation?.buildingId === n.id;
          const size = isOrigin ? 2.4 : 0.6 + n.magnitude * 1.4;
          return (
            <mesh key={n.id} position={n.position}>
              <sphereGeometry args={[size, 12, 12]} />
              <meshStandardMaterial
                color={isOrigin ? "#f5d98f" : "#cfe0ff"}
                emissive={isOrigin ? "#f5b23f" : "#7fa8ff"}
                emissiveIntensity={isOrigin ? 3.5 : 1.1 + n.magnitude}
              />
            </mesh>
          );
        })}
      </group>

      {/* Return portal to Earth / World A */}
      <mesh position={RETURN_PORTAL_POS}>
        <torusGeometry args={[8, 0.4, 16, 48]} />
        <meshStandardMaterial color="#8fd0ff" emissive="#5aa8f0" emissiveIntensity={2} />
      </mesh>
      {nearReturn && (
        <Html position={RETURN_PORTAL_POS.toArray()} center distanceFactor={30}>
          <div className="world-label">press ◆ / E to return to Gaza</div>
        </Html>
      )}

      {activeRelation && recurrence && originNode && (
        <Html position={[originNode[0], originNode[1] + 6, originNode[2]]} distanceFactor={22}>
          <div className="quran-panel">
            <div className="quran-panel-badge">COMPUTED_RELATION · root recurrence</div>
            <div className="quran-root">{recurrence.root}</div>
            <div className="quran-panel-sub">
              recurs in {recurrence.count} ayat of Sūrat al-Fātiḥah
            </div>
            {recurrence.ayat.map((ref) => {
              const ayah = AL_FATIHA.find((a) => a.surah === ref.surah && a.ayah === ref.ayah);
              if (!ayah) return null;
              return (
                <div key={`${ref.surah}:${ref.ayah}`} className="quran-ayah">
                  <div className="quran-arabic">{ayah.arabic}</div>
                  <div className="quran-translit">{ayah.transliteration}</div>
                  <div className="quran-translation">{ayah.translation}</div>
                </div>
              );
            })}
          </div>
        </Html>
      )}
    </group>
  );
}
