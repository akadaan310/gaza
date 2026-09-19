import { useMemo } from "react";
import * as THREE from "three";
import { useWorldStore } from "../store/worldStore";
import { colorForRoot } from "./rootColors";

const BEAM_LENGTH = 260;

// The persistent payoff of encountering a guide: a beam rising from the
// building along the exact unit vector InterstellarScene uses to place
// that building's star, plus a ground-level edge to the nearest other
// activated building sharing its root. Walk the city long enough and this
// becomes a visible relational graph, not a list of pins — the buildings
// read as entry points into the same computed space you cross into at the
// portal, because they're driving the same function.
export function ActivatedRelations() {
  const activated = useWorldStore((s) => s.activatedGuides);
  const edges = useWorldStore((s) => s.relationEdges);

  const beamGeometry = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    for (const rec of activated.values()) {
      const c = colorForRoot(rec.rootId);
      positions.push(...rec.worldPos);
      positions.push(
        rec.worldPos[0] + rec.direction[0] * BEAM_LENGTH,
        rec.worldPos[1] + rec.direction[1] * BEAM_LENGTH,
        rec.worldPos[2] + rec.direction[2] * BEAM_LENGTH
      );
      colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return geom;
  }, [activated]);

  const edgeGeometry = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    for (const e of edges) {
      const c = colorForRoot(e.rootId);
      positions.push(...e.a, ...e.b);
      colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return geom;
  }, [edges]);

  if (activated.size === 0) return null;

  return (
    <group>
      <lineSegments geometry={beamGeometry}>
        <lineBasicMaterial vertexColors transparent opacity={0.5} depthWrite={false} />
      </lineSegments>
      <lineSegments geometry={edgeGeometry}>
        <lineBasicMaterial vertexColors transparent opacity={0.38} depthWrite={false} />
      </lineSegments>
    </group>
  );
}
