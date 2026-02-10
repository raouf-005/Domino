import { memo } from "react";
import type { Vec3 } from "./types";

function Dot3DBase({
  pos,
  offset,
  s = 1,
}: {
  pos: [number, number];
  offset: Vec3;
  s?: number;
}) {
  return (
    <mesh
      position={[
        offset[0] + pos[0] * 0.55 * s,
        offset[1] + pos[1] * 0.55 * s,
        offset[2] + 0.07,
      ]}
    >
      <sphereGeometry args={[0.07 * s, 12, 12]} />
      <meshStandardMaterial color="#1a1a1a" metalness={0.3} roughness={0.4} />
    </mesh>
  );
}

export const Dot3D = memo(Dot3DBase);
