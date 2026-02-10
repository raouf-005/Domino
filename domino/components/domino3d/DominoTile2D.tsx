import type { Domino } from "../../lib/gameTypes";

export function DominoTile2D({
  domino,
  horizontal = false,
  isPlayable = false,
  isSelected = false,
  onClick,
  size = "normal",
}: {
  domino: Domino;
  horizontal?: boolean;
  isPlayable?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  size?: "small" | "normal" | "large";
}) {
  const dims = {
    small: horizontal ? "w-12 h-6" : "w-6 h-12",
    normal: horizontal ? "w-16 h-8" : "w-10 h-20",
    large: horizontal ? "w-20 h-10" : "w-12 h-24",
  };
  const dot = { small: "w-1 h-1", normal: "w-1.5 h-1.5", large: "w-2 h-2" };

  const dotPos = (n: number) => {
    const m: Record<number, string[]> = {
      0: [],
      1: ["center"],
      2: ["top-right", "bottom-left"],
      3: ["top-right", "center", "bottom-left"],
      4: ["top-left", "top-right", "bottom-left", "bottom-right"],
      5: ["top-left", "top-right", "center", "bottom-left", "bottom-right"],
      6: [
        "top-left",
        "top-right",
        "middle-left",
        "middle-right",
        "bottom-left",
        "bottom-right",
      ],
    };
    return m[n] ?? [];
  };

  const dotStyle = (p: string) => {
    const s: Record<string, string> = {
      "top-left": "top-0.5 left-0.5",
      "top-right": "top-0.5 right-0.5",
      "middle-left": "top-1/2 -translate-y-1/2 left-0.5",
      "middle-right": "top-1/2 -translate-y-1/2 right-0.5",
      center: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
      "bottom-left": "bottom-0.5 left-0.5",
      "bottom-right": "bottom-0.5 right-0.5",
    };
    return s[p] ?? "";
  };

  const Half = ({ value }: { value: number }) => (
    <div
      className={`relative flex-1 ${horizontal ? "h-full" : "w-full"}`}
      style={{ background: "linear-gradient(135deg,#fefefe,#f0f0e8)" }}
    >
      {dotPos(value).map((p, i) => (
        <div
          key={i}
          className={`absolute ${dot[size]} bg-gray-900 rounded-full ${dotStyle(p)}`}
          style={{ boxShadow: "inset 0 1px 2px rgba(0,0,0,.3)" }}
        />
      ))}
    </div>
  );

  return (
    <button
      onClick={onClick}
      disabled={!isPlayable && onClick !== undefined}
      className={`
        flex ${horizontal ? "flex-row" : "flex-col"} ${dims[size]}
        rounded-lg overflow-hidden transition-all duration-300 ease-out
        ${isSelected ? "scale-110 -translate-y-4 z-10" : ""}
        ${isPlayable ? "hover:scale-105 hover:-translate-y-2 cursor-pointer" : onClick ? "opacity-60 cursor-not-allowed" : ""}
        ${isSelected ? "ring-4 ring-yellow-400 shadow-2xl shadow-yellow-400/50" : "shadow-lg hover:shadow-xl"}
      `}
      style={{
        background: "linear-gradient(180deg,#2d2d2d,#1a1a1a)",
        border: "2px solid #333",
      }}
    >
      <Half value={domino.left} />
      <div
        className={`${horizontal ? "w-0.5 h-full" : "h-0.5 w-full"} bg-gray-700`}
        style={{ background: "linear-gradient(90deg,#444,#222,#444)" }}
      />
      <Half value={domino.right} />
    </button>
  );
}
