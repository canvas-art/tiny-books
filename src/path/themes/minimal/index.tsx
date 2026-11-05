// The default theme: ink on paper, no scenery. Used by any book without a theme of its own, and the
// simplest example of the theme contract. Copy this folder to start a new theme.

import type { BookSummary } from "../../../../shared/types";
import type { BossArtProps, ChapterHeaderProps, PathTheme, RoadProps, StepArtProps } from "../../types";
import "./minimal.css";

const ACCENT = { fill: "var(--path-accent)" };
const ACCENT_STROKE = { stroke: "var(--path-accent)" };
const LOCKED = { fill: "#f3f4f6", stroke: "#e3e6ea", text: "#b3b9c2" };

function Road({ d, travelled, locked }: RoadProps) {
  return (
    <g fill="none" strokeLinecap="round">
      <path d={d} stroke={locked ? "#eceef1" : "#dfe2e7"} strokeWidth="4" strokeDasharray="0.1 11" />
      {travelled && <path d={travelled} style={ACCENT_STROKE} strokeWidth="4" opacity=".85" />}
    </g>
  );
}

const shadow = (cx: number, cy: number, rx: number) => <ellipse cx={cx} cy={cy} rx={rx} ry="3.5" fill="rgb(0 0 0 / .06)" />;

function Step({ state, index }: StepArtProps) {
  const n = index + 1;
  return (
    <svg viewBox="0 0 60 64" width="60" height="64" aria-hidden>
      {shadow(30, 60, 19)}
      {state === "done" ? (
        <>
          <circle cx="30" cy="30" r="25" style={ACCENT} />
          <path d="M19.5 30.5 l7 7 l14 -15" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <circle cx="30" cy="30" r="24" fill={state === "locked" ? LOCKED.fill : "#fff"}
            style={state === "current" ? ACCENT_STROKE : undefined} stroke={LOCKED.stroke} strokeWidth={state === "current" ? 3.5 : 1.5} />
          <text x="30" y="37" textAnchor="middle" className="mn-num" style={state === "current" ? ACCENT : { fill: LOCKED.text }}>{n}</text>
        </>
      )}
    </svg>
  );
}

/** A scalloped seal with a star: the chapter quiz. */
const SEAL = (() => {
  const cx = 42, cy = 40, r = 33, bumps = 14;
  const at = (a: number, rr: number) => `${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy + rr * Math.sin(a)).toFixed(2)}`;
  let d = `M${at(0, r)}`;
  for (let i = 0; i < bumps; i++) {
    const a = (i / bumps) * Math.PI * 2, step = (Math.PI * 2) / bumps;
    d += ` Q${at(a + step / 2, r * 1.14)} ${at(a + step, r)}`;
  }
  return d + "Z";
})();
const STAR = (() => {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? 6.5 : 14;
    pts.push(`${(42 + rr * Math.cos(a)).toFixed(2)},${(41 + rr * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
})();

function Seal({ state }: BossArtProps) {
  return (
    <svg viewBox="0 0 84 86" width="84" height="86" aria-hidden>
      {shadow(42, 82, 26)}
      {state === "done" ? (
        <><path d={SEAL} style={ACCENT} /><polygon points={STAR} fill="#fff" /></>
      ) : state === "current" ? (
        <><path d={SEAL} fill="#fff" style={ACCENT_STROKE} strokeWidth="3.5" strokeLinejoin="round" /><polygon points={STAR} style={ACCENT} /></>
      ) : (
        <><path d={SEAL} fill={LOCKED.fill} stroke={LOCKED.stroke} strokeWidth="1.5" /><polygon points={STAR} fill={LOCKED.text} /></>
      )}
    </svg>
  );
}

function ChapterHeader({ chapter, locked }: ChapterHeaderProps) {
  return (
    <div className={`mn-head ${locked ? "is-locked" : ""}`}>
      <small>Chapter {chapter.position}</small>
      <strong>{chapter.title}</strong>
    </div>
  );
}

function End({ book }: { book: BookSummary }) {
  return <><span className="mn-fleuron" aria-hidden>❧</span><p>The end of {book.title}</p></>;
}

export default {
  name: "Minimal",
  Road,
  ChapterHeader,
  step: { width: 60, height: 64, anchor: 30, Art: Step },
  boss: { width: 84, height: 86, anchor: 40, Art: Seal },
  End,
} satisfies PathTheme;
