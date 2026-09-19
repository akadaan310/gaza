import { useMemo } from "react";
import * as THREE from "three";
import { coastlineLocalPolylines } from "./coastline";
import { toWorld } from "./buildingGeometry";

// The real OpenStreetMap coastline, rendered as a bright boundary line so
// the "enormous boundary/interface" reads clearly even before the ocean
// mesh alone would communicate it.
export function Coastline() {
  const lines = useMemo(
    () =>
      coastlineLocalPolylines().map((poly, i) => {
        const pts = poly.map(([x, y]) => new THREE.Vector3(...toWorld(x, y, 0.3)));
        return { id: `coast-${i}`, geom: new THREE.BufferGeometry().setFromPoints(pts) };
      }),
    []
  );

  return (
    <group>
      {lines.map((l) => (
        <primitive key={l.id} object={new THREE.Line(l.geom, coastMaterial)} />
      ))}
    </group>
  );
}

const coastMaterial = new THREE.LineBasicMaterial({ color: "#eaf6ff", transparent: true, opacity: 0.8 });
