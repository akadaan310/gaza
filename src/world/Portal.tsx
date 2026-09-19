import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useWorldStore } from "../store/worldStore";
import { toWorld } from "./buildingGeometry";
import { PORTAL_LOCAL, INTERACT_RADIUS_M } from "./landmarks";
import { GUIDE_ID } from "./Guide";

export const PORTAL_ID = "portal:palestine-square-bridge";

export function Portal() {
  const ring1 = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);
  const [inRange, setInRange] = useState(false);
  const guideDiscovered = useWorldStore((s) => s.discovered.has(GUIDE_ID));
  const lastPulse = useRef(useWorldStore.getState().interactPulse);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ring1.current) ring1.current.rotation.z = t * 0.6;
    if (ring2.current) ring2.current.rotation.z = -t * 0.4;

    const [px, py] = useWorldStore.getState().playerLocal;
    const d = Math.hypot(px - PORTAL_LOCAL[0], py - PORTAL_LOCAL[1]);
    const within = d < INTERACT_RADIUS_M;
    setInRange(within);

    if (within && guideDiscovered) {
      useWorldStore.getState().setFocus({
        id: PORTAL_ID,
        label: "Bridge Portal",
        provenance: {
          classification: "COMPUTED_RELATION",
          algorithm: "earthToInterstellar (bearing/distance unfolding + seeded jitter)",
          note: "A computed transition, not a physical claim: entering it recomputes this location's coordinates in interstellar (World B) space.",
        },
      });
    }

    const pulse = useWorldStore.getState().interactPulse;
    if (pulse !== lastPulse.current) {
      lastPulse.current = pulse;
      if (within && guideDiscovered) {
        useWorldStore.getState().discover(PORTAL_ID);
        useWorldStore.getState().setInInterstellar(true);
      }
    }
  });

  const [wx, wy, wz] = toWorld(PORTAL_LOCAL[0], PORTAL_LOCAL[1], 2.2);
  const active = guideDiscovered;

  return (
    <group position={[wx, wy, wz]}>
      <mesh ref={ring1}>
        <torusGeometry args={[2.2, 0.12, 16, 48]} />
        <meshStandardMaterial
          color={active ? "#c9a2f5" : "#5a5468"}
          emissive={active ? "#a26bf0" : "#2a2530"}
          emissiveIntensity={active ? 2.2 : 0.4}
          roughness={0.3}
        />
      </mesh>
      <mesh ref={ring2} rotation={[0, 0, Math.PI / 5]}>
        <torusGeometry args={[1.7, 0.07, 16, 48]} />
        <meshStandardMaterial
          color={active ? "#8fd0ff" : "#4a4658"}
          emissive={active ? "#6bb8f0" : "#26242e"}
          emissiveIntensity={active ? 1.8 : 0.3}
          roughness={0.3}
        />
      </mesh>
      {active && <pointLight intensity={3} distance={12} color="#b58cf5" />}
      {inRange && (
        <Html position={[0, 3, 0]} center distanceFactor={12} occlude>
          <div className="world-label">
            {active
              ? "hold ◆ / press E to cross the bridge"
              : "the portal is still — find the guide first"}
          </div>
        </Html>
      )}
    </group>
  );
}
