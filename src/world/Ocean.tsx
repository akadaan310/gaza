import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// One large sea plane west of the real coastline. Not tile-streamed (it's
// a single cheap mesh), gently animated for a living-water feel without a
// full water shader.
export function Ocean() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const mat = ref.current?.material as THREE.MeshStandardMaterial | undefined;
    if (mat) {
      mat.normalScale.set(0.15 + Math.sin(clock.elapsedTime * 0.3) * 0.02, 0.15);
    }
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[-3000, -0.15, 0]} receiveShadow>
      <planeGeometry args={[6000, 12000, 1, 1]} />
      <meshStandardMaterial color="#0d3a4f" roughness={0.15} metalness={0.35} normalScale={new THREE.Vector2(0.15, 0.15)} />
    </mesh>
  );
}
