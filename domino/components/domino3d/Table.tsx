"use client";

import { useMemo } from "react";
import * as THREE from "three";

export function Table() {
  const rim = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#5a3a1a",
        metalness: 0.3,
        roughness: 0.7,
      }),
    [],
  );
  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.15, 0]}
        receiveShadow
      >
        <planeGeometry args={[55, 35]} />
        <meshStandardMaterial color="#1a5c2a" metalness={0.1} roughness={0.9} />
      </mesh>
      {/* Rim */}
      <mesh position={[0, -0.1, -17.5]} material={rim}>
        <boxGeometry args={[55, 0.4, 0.5]} />
      </mesh>
      <mesh position={[0, -0.1, 17.5]} material={rim}>
        <boxGeometry args={[55, 0.4, 0.5]} />
      </mesh>
      <mesh position={[-27.5, -0.1, 0]} material={rim}>
        <boxGeometry args={[0.5, 0.4, 35.5]} />
      </mesh>
      <mesh position={[27.5, -0.1, 0]} material={rim}>
        <boxGeometry args={[0.5, 0.4, 35.5]} />
      </mesh>
    </group>
  );
}
