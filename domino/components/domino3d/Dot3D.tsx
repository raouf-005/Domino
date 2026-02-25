import { memo, useMemo } from "react";
import * as THREE from "three";
import type { Vec3 } from "./types";

// Shared geometry + material (created once, reused by every dot)
const DOT_GEO = new THREE.SphereGeometry(0.07, 6, 6);
const DOT_MAT = new THREE.MeshStandardMaterial({
  color: "#1a1a1a",
  metalness: 0.3,
  roughness: 0.4,
});

function Dot3DBase({
  pos,
  offset,
  s = 1,
}: {
  pos: [number, number];
  offset: Vec3;
  s?: number;
}) {
  const scaledGeo = useMemo(() => {
    if (s === 1) return DOT_GEO;
    const g = DOT_GEO.clone();
    g.scale(s, s, s);
    return g;
  }, [s]);

  return (
    <mesh
      position={[
        offset[0] + pos[0] * 0.55 * s,
        offset[1] + pos[1] * 0.55 * s,
        offset[2] + 0.07,
      ]}
      geometry={scaledGeo}
      material={DOT_MAT}
    />
  );
}

export const Dot3D = memo(Dot3DBase);
