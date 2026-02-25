"use client";

import * as THREE from "three";

// Shared materials — created once
const FELT_MAT = new THREE.MeshStandardMaterial({
  color: "#1a5c2a",
  metalness: 0.1,
  roughness: 0.9,
});
const RIM_MAT = new THREE.MeshStandardMaterial({
  color: "#5a3a1a",
  metalness: 0.3,
  roughness: 0.7,
});
const FELT_GEO = new THREE.PlaneGeometry(55, 35);
const RIM_TOP = new THREE.BoxGeometry(55, 0.4, 0.5);
const RIM_SIDE = new THREE.BoxGeometry(0.5, 0.4, 35.5);

export function Table() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.15, 0]} geometry={FELT_GEO} material={FELT_MAT} />
      <mesh position={[0, -0.1, -17.5]} geometry={RIM_TOP} material={RIM_MAT} />
      <mesh position={[0, -0.1, 17.5]} geometry={RIM_TOP} material={RIM_MAT} />
      <mesh position={[-27.5, -0.1, 0]} geometry={RIM_SIDE} material={RIM_MAT} />
      <mesh position={[27.5, -0.1, 0]} geometry={RIM_SIDE} material={RIM_MAT} />
    </group>
  );
}
