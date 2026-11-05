// Roman road: milestones, triumphal arches and inscription tablets from the world Marcus wrote in.

import type { ReactElement } from "react";
import type { BookSummary } from "../../../../shared/types";
import type { BossArtProps, ChapterHeaderProps, NodeState, RoadProps, StepArtProps } from "../../types";
import { roman } from "../../../format";

export const C = {
  gold: "#c9a227",
  goldDark: "#a8841a",
  laurel: "#7d9b5d",
  laurelDark: "#5f7d45",
  cypress: "#5e7f57",
  cypressLight: "#7a9a6a",
  olive: "#9fb388",
  oliveDark: "#86a06f",
  bark: "#8a6c4f",
  marble: "#f6f3ec",
  marbleMid: "#e7e1d5",
  marbleShade: "#cfc6b6",
  stone: "#ebedf0",
  stoneMid: "#dde0e5",
  stoneShade: "#c4c9d1",
  terracotta: "#cf7f57",
  terracottaDark: "#b0653f",
  canvas: "#efe3cb",
  canvasShade: "#dccaa8",
  sea: "#8fbcd9",
  seaDark: "#6c9fc2",
  red: "#b8473a",
  ink: "#6f665a",
};

/** Gradient fills, referenced as url(#roman-…). */
export const MARBLE = "url(#roman-marble)";
const STONE = "url(#roman-stone)";

export function Defs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
      <defs>
        <linearGradient id="roman-marble" x1="0" x2="1">
          <stop offset="0" stopColor="#fffdf8" /><stop offset=".55" stopColor={C.marble} /><stop offset="1" stopColor={C.marbleShade} />
        </linearGradient>
        <linearGradient id="roman-stone" x1="0" x2="1">
          <stop offset="0" stopColor="#f6f7f9" /><stop offset=".55" stopColor={C.stone} /><stop offset="1" stopColor={C.stoneShade} />
        </linearGradient>
        <linearGradient id="roman-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bcd2ff" /><stop offset="1" stopColor="#eaf1ff" />
        </linearGradient>
        <linearGradient id="roman-glow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7e7b4" /><stop offset="1" stopColor="#fdf6e1" />
        </linearGradient>
        <linearGradient id="roman-sun" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6c768" /><stop offset="1" stopColor="#f2a65a" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** An unpaved track ahead, paved stone behind you. */
export function Road({ d, travelled, locked }: RoadProps) {
  return (
    <g fill="none" strokeLinecap="round">
      <path d={d} stroke={locked ? "#f4f5f7" : "#f1eee7"} strokeWidth="40" />
      <path d={d} stroke="#e2ddd2" strokeWidth="2.5" strokeDasharray="2 9" />
      {travelled && <>
        <path d={travelled} stroke="#dccfb4" strokeWidth="40" />                         {/* kerb stones */}
        <path d={travelled} stroke="#efe7d6" strokeWidth="33" />
        <path d={travelled} stroke="#e2d6bd" strokeWidth="5" strokeDasharray="0.1 11" />  {/* worn cobbles */}
      </>}
    </g>
  );
}

/** A ring of laurel leaves, open at the top, like a victor's crown. */
function Laurel({ cx, cy, r, color = C.gold, leaf = 3.2 }: { cx: number; cy: number; r: number; color?: string; leaf?: number }) {
  const leaves: ReactElement[] = [];
  const n = 6;
  for (const side of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      // from the bottom (90°) up to near the top on each side
      const a = (Math.PI / 2) + side * (0.25 + (i / (n - 1)) * 2.35);
      const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
      const rot = (a * 180) / Math.PI + (side > 0 ? 90 + 25 : 90 - 25);
      leaves.push(<ellipse key={`${side}${i}`} cx={x} cy={y} rx={leaf} ry={leaf * 0.45} transform={`rotate(${rot} ${x} ${y})`} fill={color} />);
    }
  }
  return <g>{leaves}</g>;
}

const surface = (state: NodeState) => ({
  fill: state === "locked" ? STONE : MARBLE,
  edge: state === "locked" ? C.stoneShade : C.marbleShade,
  opacity: state === "locked" ? 0.7 : 1,
});

/** Roman milestone (miliarium), engraved with the step's number. */
export function Milestone({ state, index }: StepArtProps) {
  const { fill, edge, opacity } = surface(state);
  const top = state === "locked" ? C.stoneMid : "#fbf9f4";
  const engraved = state === "locked" ? "#b4bac4" : state === "done" ? C.goldDark : C.ink;
  const numeral = roman(index + 1);
  return (
    <svg viewBox="0 0 64 84" width="64" height="84" opacity={opacity} aria-hidden>
      <ellipse cx="32" cy="79" rx="27" ry="4.5" fill="rgb(40 30 10 / .10)" />
      <rect x="7" y="64" width="50" height="13" rx="2.5" fill={fill} stroke={edge} strokeWidth="1" />
      <rect x="7.5" y="64.5" width="49" height="3" rx="1.5" fill={top} />
      <path d="M14 20 V65 Q32 70 50 65 V20 Z" fill={fill} stroke={edge} strokeWidth="1" />
      <ellipse cx="32" cy="20" rx="18" ry="5.5" fill={top} stroke={edge} strokeWidth="1" />
      {state === "done" && <Laurel cx={32} cy={43} r={12.5} />}
      <text x="32" y={state === "done" ? 47.5 : 48} textAnchor="middle" fontFamily="Cinzel, serif" fontWeight="700"
        fontSize={numeral.length > 3 ? 10 : numeral.length > 2 ? 12 : 14} fill={engraved}>{numeral}</text>
    </svg>
  );
}

/** Triumphal arch: the end-of-book quiz. */
export function Arch({ state }: BossArtProps) {
  const { fill, edge, opacity } = surface(state);
  const opening = state === "locked" ? "#c9ced6" : state === "done" ? "url(#roman-glow)" : "url(#roman-sky)";
  const detail = state === "locked" ? "#d3d7dd" : C.marbleMid;
  return (
    <svg viewBox="0 0 100 96" width="100" height="96" opacity={opacity} aria-hidden>
      <ellipse cx="50" cy="90" rx="44" ry="5.5" fill="rgb(40 30 10 / .10)" />
      <rect x="6" y="78" width="88" height="9" rx="2" fill={fill} stroke={edge} />
      <path d="M12 78 V34 H88 V78 H64 V56 A14 14 0 0 0 36 56 V78 Z" fill={fill} stroke={edge} />
      <path d="M36 78 V56 A14 14 0 0 1 64 56 V78 Z" fill={opening} />
      {/* engaged columns */}
      {[18, 28, 72, 82].map((x) => <rect key={x} x={x - 2} y="38" width="4" height="40" rx="1" fill={detail} />)}
      <rect x="4" y="31" width="92" height="5" rx="1.5" fill={fill} stroke={edge} />
      <rect x="9" y="14" width="82" height="18" rx="1.5" fill={fill} stroke={edge} />
      <rect x="30" y="19.5" width="40" height="2.5" rx="1" fill={detail} />
      <rect x="36" y="24.5" width="28" height="2.5" rx="1" fill={detail} />
      {state === "done" && <Laurel cx={50} cy={8} r={7} leaf={2.6} />}
      {state === "current" && <circle cx="50" cy="66" r="4" fill="#fff" opacity=".9" />}
    </svg>
  );
}

/** Inscription tablet with dovetail handles (tabula ansata), carved with the book's number and title. */
export function ChapterHeader({ chapter, locked, width }: ChapterHeaderProps) {
  const fill = locked ? STONE : MARBLE;
  const edge = locked ? C.stoneShade : C.marbleShade;
  return (
    <div className={`rm-tablet ${locked ? "is-locked" : ""}`} style={{ width: Math.min(320, width - 8) }}>
      <svg viewBox="0 0 320 88" preserveAspectRatio="none" width="100%" height="88" aria-hidden>
        <path d="M36 6 H284 L314 4 V84 L284 82 H36 L6 84 V4 Z" fill={fill} stroke={edge} strokeWidth="1.2" />
        <path d="M36 6 L6 4 V84 L36 82 Z M284 6 L314 4 V84 L284 82 Z" fill={locked ? C.stoneMid : C.marbleMid} opacity=".7" />
        <rect x="44" y="13" width="232" height="62" rx="2" fill="none" stroke={edge} strokeWidth="1" />
        <circle cx="21" cy="44" r="2.4" fill={edge} /><circle cx="299" cy="44" r="2.4" fill={edge} />
      </svg>
      <div className="rm-tablet-text">
        <small>Liber {roman(chapter.position)}</small>
        <strong>{chapter.title}</strong>
      </div>
    </div>
  );
}

/** FINIS: the end of the road. */
export function End({ book }: { book: BookSummary }) {
  return (
    <>
      <svg viewBox="0 0 60 60" width="44" height="44" aria-hidden>
        <circle cx="30" cy="30" r="22" fill="none" stroke={C.gold} strokeWidth="2" />
        <text x="30" y="36" textAnchor="middle" fontFamily="Cinzel, serif" fontWeight="700" fontSize="16" fill={C.goldDark}>FIN</text>
      </svg>
      <p>The end of {book.title}</p>
    </>
  );
}
