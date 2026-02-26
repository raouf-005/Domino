export function TurnOverlay({
  myTurn,
  canPass,
  onPass,
}: {
  myTurn: boolean;
  canPass: boolean;
  onPass: () => void;
}) {
  if (!myTurn) return null;
  return (
    <div className="turn-overlay absolute bottom-2 sm:bottom-4 left-0 right-0 flex justify-center gap-2 sm:gap-4 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-2 sm:gap-4">
        <span className="bg-linear-to-r from-yellow-400 to-amber-500 text-yellow-900 px-3 py-1.5 sm:px-5 sm:py-2 rounded-full font-bold shadow-lg text-xs sm:text-lg">
          Your Turn — Drag a tile!
        </span>
        {canPass && (
          <button
            onClick={onPass}
            className="px-4 py-2 sm:px-6 sm:py-3 bg-linear-to-r from-orange-500 to-red-500 text-white rounded-xl font-bold hover:from-orange-600 hover:to-red-600 transition-all shadow-lg text-xs sm:text-base"
          >
            Pass
          </button>
        )}
      </div>
    </div>
  );
}

export function EndLabels({ left, right }: { left: number; right: number }) {
  return (
    <div className="end-labels absolute top-2 sm:top-4 left-0 right-0 flex justify-between px-3 sm:px-6 pointer-events-none">
      <span className="bg-black/40 text-white px-2 py-0.5 sm:px-3 sm:py-1 rounded-full font-mono backdrop-blur-sm text-xs sm:text-lg">
        {/*      {left >= 0 ? left : "-"} */}
      </span>
      <span className="bg-gradient-to-r from-blue-500/60 to-purple-500/60 text-white font-bold text-xs sm:text-sm backdrop-blur-md px-3 py-0.5 sm:px-3 sm:py-0.5 rounded-full shadow-lg border border-white/20">
        Game Board
      </span>
      <span className="bg-black/40 text-white px-2 py-0.5 sm:px-3 sm:py-1 rounded-full font-mono backdrop-blur-sm text-xs sm:text-lg">
        {/*         {right >= 0 ? right : "-"}
         */}{" "}
      </span>
    </div>
  );
}

export function BoardBadge() {
  return null;
}
