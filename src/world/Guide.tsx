import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useWorldStore } from "../store/worldStore";
import { toWorld } from "./buildingGeometry";
import { GUIDE_LOCAL, PORTAL_LOCAL, DISCOVERY_RADIUS_M } from "./landmarks";
import { findNearestBuilding } from "./focus";
import { rootForNodeId } from "../quran/data";

export const GUIDE_ID = "guide:palestine-square";

export function Guide() {
  const ref = useRef<THREE.Group>(null);
  const [nearby, setNearby] = useState(false);
  const discovered = useWorldStore((s) => s.discovered.has(GUIDE_ID));
  const realTiles = useWorldStore((s) => s.loadedRealTiles);

  const anchorBuilding = useMemo(
    () => findNearestBuilding(realTiles, GUIDE_LOCAL),
    [realTiles]
  );

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.position.y = 0.15 + Math.sin(t * 1.4) * 0.08;

    // Point toward the portal once the visitor is close enough to notice.
    const [gx, gy] = GUIDE_LOCAL;
    const [px, py] = [PORTAL_LOCAL[0] - gx, PORTAL_LOCAL[1] - gy];
    const targetYaw = Math.atan2(px, -py);
    ref.current.rotation.y = discovered ? targetYaw : Math.sin(t * 0.5) * 0.6;

    const [playerX, playerY] = useWorldStore.getState().playerLocal;
    const d = Math.hypot(playerX - gx, playerY - gy);
    setNearby(d < DISCOVERY_RADIUS_M);
    if (d < DISCOVERY_RADIUS_M) {
      useWorldStore.getState().discover(GUIDE_ID);
      if (anchorBuilding) {
        const root = rootForNodeId(anchorBuilding.id);
        useWorldStore.getState().setActiveRelation({ rootId: root.root, buildingId: anchorBuilding.id });
      }
    }
  });

  useEffect(() => {
    if (nearby) {
      useWorldStore.getState().setFocus({
        id: GUIDE_ID,
        label: "Gaza Guide",
        provenance: {
          classification: "SYMBOLIC_OBJECT",
          confidence: "illustrative",
          note: "An anonymous, non-identifying figure — an artistic manifestation of the computational relation anchored to the nearest real structure, not a depiction of any real person.",
        },
        extra: anchorBuilding
          ? { anchoredTo: anchorBuilding.id, anchorArea: `${anchorBuilding.areaM2} m²` }
          : {},
      });
    }
  }, [nearby, anchorBuilding]);

  const [wx, wy, wz] = toWorld(GUIDE_LOCAL[0], GUIDE_LOCAL[1], 0);

  return (
    <group position={[wx, wy, wz]} ref={ref}>
      <mesh position={[0, 1.05, 0]} castShadow>
        <capsuleGeometry args={[0.32, 1.15, 6, 12]} />
        <meshStandardMaterial
          color="#dff3ff"
          emissive="#8fd0ff"
          emissiveIntensity={discovered ? 1.4 : 0.7}
          roughness={0.25}
          transparent
          opacity={0.82}
        />
      </mesh>
      <pointLight position={[0, 1.4, 0]} intensity={2.2} distance={9} color="#9fd6ff" />
      {nearby && (
        <Html position={[0, 2.3, 0]} center distanceFactor={12} occlude>
          <div className="world-label">
            {discovered ? "the guide points toward a portal" : "a presence stirs"}
          </div>
        </Html>
      )}
    </group>
  );
}
