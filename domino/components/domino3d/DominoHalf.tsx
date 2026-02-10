import { memo } from "react";
import { DOT_MAP } from "./constants";
import type { Vec3 } from "./types";
import { Dot3D } from "./Dot3D";

function DominoHalfBase({
  value,
  offset,
  s = 1,
}: {
  value: number;
  offset: Vec3;
  s?: number;
}) {
  const dots = DOT_MAP[value] ?? [];
  return (
    <>
      {dots.map((p, i) => (
        <Dot3D key={i} pos={p} offset={offset} s={s} />
      ))}
    </>
  );
}

export const DominoHalf = memo(DominoHalfBase);
