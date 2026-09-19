import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useWorldStore } from "../store/worldStore";
import { toWorld } from "./buildingGeometry";
import { COMMAND_CENTER_LOCAL, INTERACT_RADIUS_M } from "./landmarks";

export const COMMAND_CENTER_ID = "command-center:palestine-square";

export function CommandCenter() {
  const [inRange, setInRange] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null);
  const lastPulse = useRef(useWorldStore.getState().interactPulse);

  useFrame(({ clock }) => {
    if (meshRef.current) meshRef.current.rotation.y = clock.elapsedTime * 0.15;
    const [px, py] = useWorldStore.getState().playerLocal;
    const d = Math.hypot(px - COMMAND_CENTER_LOCAL[0], py - COMMAND_CENTER_LOCAL[1]);
    const within = d < INTERACT_RADIUS_M;
    setInRange(within);
    if (within) {
      useWorldStore.getState().discover(COMMAND_CENTER_ID);
      useWorldStore.getState().setFocus({
        id: COMMAND_CENTER_ID,
        label: "Earth Command Center",
        provenance: {
          classification: "SYMBOLIC_OBJECT",
          note: "A spatial interface into the world's own data — not a physical structure in Gaza.",
        },
      });
    }
    const pulse = useWorldStore.getState().interactPulse;
    if (pulse !== lastPulse.current) {
      lastPulse.current = pulse;
      if (within) useWorldStore.getState().setCommandCenterOpen(!useWorldStore.getState().commandCenterOpen);
    }
  });

  const [wx, wy, wz] = toWorld(COMMAND_CENTER_LOCAL[0], COMMAND_CENTER_LOCAL[1], 1.6);

  return (
    <group position={[wx, wy, wz]}>
      <mesh ref={meshRef} castShadow>
        <boxGeometry args={[1.1, 3.2, 1.1]} />
        <meshStandardMaterial color="#1a1a22" emissive="#2f2a4a" emissiveIntensity={0.6} roughness={0.35} metalness={0.4} />
      </mesh>
      <pointLight position={[0, 2, 0]} intensity={1.4} distance={8} color="#7f8fff" />
      {inRange && (
        <Html position={[0, 2.4, 0]} center distanceFactor={12} occlude>
          <div className="world-label">press ◆ / E to open the command center</div>
        </Html>
      )}
    </group>
  );
}
