import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Sky, Stars } from "@react-three/drei";
import * as THREE from "three";
import { useWorldStore } from "../store/worldStore";

const DAY_LENGTH_SECONDS = 240; // one full day/night cycle in real seconds

export function SkySystem() {
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const sunPos = useRef(new THREE.Vector3(0, 1, 0));

  useFrame((_, delta) => {
    useWorldStore.getState().tickTime((delta / DAY_LENGTH_SECONDS) * 24);
    const t = useWorldStore.getState().timeOfDay; // 0..1
    const angle = t * Math.PI * 2 - Math.PI / 2;
    const elevation = Math.sin(angle);
    const azimuth = Math.cos(angle);
    sunPos.current.set(azimuth * 1000, elevation * 1000, 400);
    if (sunRef.current) {
      sunRef.current.position.copy(sunPos.current);
      const intensity = Math.max(0.05, elevation);
      sunRef.current.intensity = intensity * 7.5;
    }
  });

  const discoveredCount = useWorldStore((s) => s.discovered.size);
  const starOpacity = Math.min(1, 0.25 + discoveredCount * 0.08);
  const isNight = useWorldStore((s) => Math.sin(s.timeOfDay * Math.PI * 2 - Math.PI / 2) < 0.15);

  return (
    <>
      <Sky
        distance={450000}
        sunPosition={sunPos.current.toArray()}
        turbidity={5}
        rayleigh={1.1}
        mieCoefficient={0.008}
        mieDirectionalG={0.82}
      />
      {isNight && (
        <Stars
          radius={400}
          depth={80}
          count={2500}
          factor={4}
          saturation={0}
          fade
          speed={0.15}
          // eslint-disable-next-line react/no-unknown-property
          material-opacity={starOpacity}
        />
      )}
      <directionalLight
        ref={sunRef}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={2000}
        shadow-camera-left={-400}
        shadow-camera-right={400}
        shadow-camera-top={400}
        shadow-camera-bottom={-400}
        shadow-bias={-0.0004}
        color={"#fff2df"}
      />
      <ambientLight intensity={0.5} color={"#dce8f5"} />
      <hemisphereLight args={["#cfe6ff", "#8a7350", 1.3]} />
      <directionalLight position={[-500, 250, -300]} intensity={0.8} color={"#a8c8e8"} />
      <fog attach="fog" args={["#cfe3ee", 80, 1500]} />
    </>
  );
}
