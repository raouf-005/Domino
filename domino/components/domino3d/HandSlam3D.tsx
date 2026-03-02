"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Domino } from "../../lib/gameTypes";
import { DOT_MAP } from "./constants";
import type { Vec3 } from "./types";

/**
 * HandSlam3D – An open hand that slams the last domino tile onto the table.
 *
 * The animation:
 * 1. Hand appears above, raised high, holding the last domino tile
 * 2. Swings down rapidly with quartic acceleration
 * 3. SLAMS the tile onto the table – triggers camera shake + board impact
 * 4. Hand lifts away while the tile stays on the board
 * 5. Fades out
 */

/* ─── Mini domino tile rendered inline ─── */
function SlamDot({
  pos,
  offset,
  s = 1,
}: {
  pos: [number, number];
  offset: [number, number, number];
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
      <sphereGeometry args={[0.07 * s, 6, 6]} />
      <meshStandardMaterial color="#1a1a1a" metalness={0.3} roughness={0.4} />
    </mesh>
  );
}

function SlamTile({ domino }: { domino: Domino }) {
  const dotsL = DOT_MAP[domino.left] ?? [];
  const dotsR = DOT_MAP[domino.right] ?? [];
  return (
    <group>
      <mesh>
        <boxGeometry args={[1, 2, 0.18]} />
        <meshStandardMaterial
          color="#f5f5f0"
          metalness={0.05}
          roughness={0.25}
        />
      </mesh>
      <mesh position={[0, 0, 0.1]}>
        <boxGeometry args={[0.8, 0.03, 0.01]} />
        <meshStandardMaterial color="#555" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, -0.1]}>
        <boxGeometry args={[1.02, 2.02, 0.01]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.2} />
      </mesh>
      {dotsL.map((p, i) => (
        <SlamDot key={`l${i}`} pos={p} offset={[0, 0.5, 0]} />
      ))}
      {dotsR.map((p, i) => (
        <SlamDot key={`r${i}`} pos={p} offset={[0, -0.5, 0]} />
      ))}
    </group>
  );
}

/* ─── Finger helper ─── */
function Finger({
  position,
  args,
  rotation,
  color,
}: {
  position: [number, number, number];
  args: [number, number, number];
  rotation?: [number, number, number];
  color: string;
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} roughness={0.6} metalness={0.1} />
    </mesh>
  );
}

/* ─── Main component ─── */
export function HandSlam3D({
  active,
  onShakeAction,
  onImpactAction,
  lastTile,
  targetPos,
}: {
  active: boolean;
  onShakeAction?: () => void;
  onImpactAction?: () => void;
  lastTile?: Domino | null;
  targetPos?: Vec3;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const progressRef = useRef(0);
  const hasShaken = useRef(false);
  const fadeRef = useRef(1);
  const phaseRef = useRef<"idle" | "slam" | "impact" | "lift" | "done">("idle");

  const targetX = targetPos?.[0] ?? 0;
  const targetZ = targetPos?.[2] ?? 1.5;
  const impactY = (targetPos?.[1] ?? 0.1) + 0.5;

  // Reset when active changes
  useMemo(() => {
    if (active) {
      progressRef.current = 0;
      hasShaken.current = false;
      fadeRef.current = 1;
      phaseRef.current = "slam";
      if (groupRef.current) {
        groupRef.current.position.x = targetX;
        groupRef.current.position.z = targetZ;
      }
    } else {
      phaseRef.current = "idle";
    }
  }, [active, targetX, targetZ]);

  useFrame((_, delta) => {
    if (
      !groupRef.current ||
      phaseRef.current === "idle" ||
      phaseRef.current === "done"
    )
      return;

    const dt = Math.min(delta, 0.05);

    if (phaseRef.current === "slam") {
      // Fast swing down: 0 → 1
      progressRef.current += dt * 3.2;
      if (progressRef.current >= 1) {
        progressRef.current = 1;
        phaseRef.current = "impact";
        if (!hasShaken.current) {
          hasShaken.current = true;
          onShakeAction?.();
          onImpactAction?.();
        }
      }
      const t = progressRef.current;
      // Quartic ease-in: slow start → very fast at end
      const eased = t * t * t * t;

      // Start: y=14, rotX=-1.4 (hand tilted back)
      // End: y=0.6, rotX=-0.15 (nearly flat, palm hitting table)
      const y = impactY + 13.4 - 13.4 * eased;
      const rotX = -1.4 + 1.25 * eased;

      groupRef.current.position.y = y;
      groupRef.current.position.x = targetX;
      groupRef.current.position.z = targetZ;
      groupRef.current.rotation.x = rotX;
      groupRef.current.visible = true;
      groupRef.current.scale.setScalar(1);
    } else if (phaseRef.current === "impact") {
      // Brief freeze at impact then small bounce
      progressRef.current += dt * 5;
      if (progressRef.current >= 2) {
        progressRef.current = 2;
        phaseRef.current = "lift";
      }
      const impactT = progressRef.current - 1; // 0→1
      const bounceY = Math.sin(impactT * Math.PI) * 0.35;
      groupRef.current.position.y = impactY + bounceY;
      groupRef.current.position.x = targetX;
      groupRef.current.position.z = targetZ;
      // Slight wobble
      groupRef.current.rotation.z = Math.sin(impactT * Math.PI * 3) * 0.02;
    } else if (phaseRef.current === "lift") {
      // Hand lifts away and fades
      fadeRef.current -= dt * 0.8;
      if (fadeRef.current <= 0) {
        fadeRef.current = 0;
        phaseRef.current = "done";
        groupRef.current.visible = false;
      }
      const liftT = 1 - fadeRef.current; // 0→1
      groupRef.current.position.y = impactY + liftT * 5;
      groupRef.current.position.x = targetX;
      groupRef.current.position.z = targetZ;
      groupRef.current.rotation.x = -0.15 - liftT * 0.5;
      groupRef.current.rotation.z = 0;
      const s = 0.85 + fadeRef.current * 0.15;
      groupRef.current.scale.setScalar(s);
    }
  });

  if (!active && phaseRef.current === "idle") return null;

  const skin = "#C88B5E";
  const skinDark = "#B07A4F";

  return (
    <group
      ref={groupRef}
      position={[targetX, impactY + 13.4, targetZ]}
      rotation={[-1.4, 0, 0]}
      visible={false}
    >
      {/* ── The domino tile held between fingers ── */}
      {lastTile && (
        <group position={[0, -0.3, -0.45]}>
          <SlamTile domino={lastTile} />
        </group>
      )}

      {/* ── Open palm / hand ── */}
      <group>
        {/* Palm */}
        <mesh position={[0, 0.15, 0]} castShadow>
          <boxGeometry args={[1.8, 0.55, 1.4]} />
          <meshStandardMaterial
            color={skin}
            roughness={0.65}
            metalness={0.05}
          />
        </mesh>

        {/* Palm underside */}
        <mesh position={[0, -0.1, 0]} castShadow>
          <boxGeometry args={[1.7, 0.15, 1.3]} />
          <meshStandardMaterial
            color={skinDark}
            roughness={0.7}
            metalness={0.05}
          />
        </mesh>

        {/* Index finger */}
        <Finger
          position={[-0.55, -0.05, -0.95]}
          args={[0.32, 0.3, 0.75]}
          color={skin}
        />
        <Finger
          position={[-0.55, -0.05, -1.45]}
          args={[0.28, 0.26, 0.45]}
          color={skin}
        />

        {/* Middle finger */}
        <Finger
          position={[-0.18, -0.05, -1.0]}
          args={[0.32, 0.3, 0.85]}
          color={skin}
        />
        <Finger
          position={[-0.18, -0.05, -1.55]}
          args={[0.28, 0.26, 0.45]}
          color={skin}
        />

        {/* Ring finger */}
        <Finger
          position={[0.18, -0.05, -0.95]}
          args={[0.32, 0.3, 0.8]}
          color={skin}
        />
        <Finger
          position={[0.18, -0.05, -1.48]}
          args={[0.28, 0.26, 0.45]}
          color={skin}
        />

        {/* Pinky */}
        <Finger
          position={[0.52, -0.05, -0.85]}
          args={[0.28, 0.28, 0.65]}
          color={skin}
        />
        <Finger
          position={[0.52, -0.05, -1.3]}
          args={[0.24, 0.24, 0.35]}
          color={skin}
        />

        {/* Thumb */}
        <mesh position={[-0.95, 0.0, -0.15]} rotation={[0, 0, 0.5]} castShadow>
          <boxGeometry args={[0.35, 0.32, 0.8]} />
          <meshStandardMaterial
            color={skin}
            roughness={0.65}
            metalness={0.05}
          />
        </mesh>
        <mesh position={[-1.15, 0.08, -0.55]} rotation={[0, 0, 0.4]} castShadow>
          <boxGeometry args={[0.3, 0.28, 0.5]} />
          <meshStandardMaterial
            color={skin}
            roughness={0.65}
            metalness={0.05}
          />
        </mesh>

        {/* Knuckle ridge */}
        <mesh position={[0, 0.0, -0.62]} castShadow>
          <boxGeometry args={[1.7, 0.18, 0.25]} />
          <meshStandardMaterial
            color={skinDark}
            roughness={0.7}
            metalness={0.05}
          />
        </mesh>

        {/* Wrist */}
        <mesh position={[0, 0.18, 0.95]} castShadow>
          <boxGeometry args={[1.4, 0.55, 0.9]} />
          <meshStandardMaterial
            color={skin}
            roughness={0.65}
            metalness={0.05}
          />
        </mesh>

        {/* Forearm */}
        <mesh position={[0, 0.2, 1.7]} castShadow>
          <boxGeometry args={[1.5, 0.6, 0.8]} />
          <meshStandardMaterial
            color={skin}
            roughness={0.65}
            metalness={0.05}
          />
        </mesh>

        {/* Sleeve cuff */}
        <mesh position={[0, 0.22, 2.2]} castShadow>
          <boxGeometry args={[1.65, 0.7, 0.5]} />
          <meshStandardMaterial
            color="#2d2d3d"
            roughness={0.8}
            metalness={0.1}
          />
        </mesh>
      </group>
    </group>
  );
}
