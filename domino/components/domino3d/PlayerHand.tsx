import type { Domino } from "../../lib/gameTypes";
import type { Side, Vec3 } from "./types";
import { DragTile } from "./DragTile";

interface HandProps {
  hand: Domino[];
  myTurn: boolean;
  sides: (d: Domino) => Side[];
  onPlay: (id: string, s: Side) => void;
  onDrag: (a: boolean, s: Side[]) => void;
  leftDrop: Vec3;
  rightDrop: Vec3;
}

export function PlayerHand({
  hand,
  myTurn,
  sides,
  onPlay,
  onDrag,
  leftDrop,
  rightDrop,
}: HandProps) {
  return (
    <>
      {hand.map((d, i) => {
        const s = myTurn ? sides(d) : [];
        return (
          <DragTile
            key={d.id}
            domino={d}
            index={i}
            total={hand.length}
            playable={s.length > 0}
            myTurn={myTurn}
            sides={s}
            onPlay={onPlay}
            onDrag={onDrag}
            leftDrop={leftDrop}
            rightDrop={rightDrop}
          />
        );
      })}
    </>
  );
}
