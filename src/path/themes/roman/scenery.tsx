// Scenery that stands beside the Roman road. Each piece is drawn in its own w×h box, standing on
// y = h and centred on x = w / 2.

import type { ReactElement } from "react";
import type { BookSummary, ChapterView } from "../../../../shared/types";
import type { Decor } from "../../types";
import { C, MARBLE } from "./art";

/** A piece standing on the ground, with a soft shadow at its foot. */
const piece = (w: number, h: number, el: ReactElement): Decor => ({
  w, h,
  el: <g><ellipse cx={w / 2} cy={h} rx={w * 0.42} ry="4" fill="rgb(40 30 10 / .07)" />{el}</g>,
});

const cypress = (s = 1) => piece(34 * s, 92 * s, (
  <g transform={`scale(${s})`}>
    <rect x="15" y="78" width="4" height="14" rx="1" fill={C.bark} />
    <path d="M17 2 C27 22 30 52 26 80 L8 80 C4 52 7 22 17 2 Z" fill={C.cypress} />
    <path d="M17 2 C12 24 10 52 12 80 L8 80 C4 52 7 22 17 2 Z" fill={C.cypressLight} />
  </g>
));

const olive = piece(84, 74, (
  <g>
    <path d="M40 74 C40 62 36 56 30 50 M42 74 C43 60 48 54 54 46 M41 64 C41 56 42 48 41 40" stroke={C.bark} strokeWidth="4" strokeLinecap="round" fill="none" />
    <circle cx="26" cy="38" r="16" fill={C.oliveDark} /><circle cx="56" cy="34" r="17" fill={C.oliveDark} />
    <circle cx="40" cy="24" r="18" fill={C.olive} /><circle cx="22" cy="32" r="11" fill={C.olive} /><circle cx="62" cy="28" r="11" fill={C.olive} />
    {[[30, 20], [48, 30], [58, 24], [22, 38]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.8" fill="#55603f" />)}
  </g>
));

const temple = piece(96, 74, (
  <g>
    <path d="M8 26 L48 6 L88 26 Z" fill={MARBLE} stroke={C.marbleShade} />
    <rect x="10" y="26" width="76" height="7" fill={C.marbleMid} stroke={C.marbleShade} />
    {[16, 32, 48, 64, 80].map((x) => <rect key={x} x={x - 3.5} y="33" width="7" height="31" fill={MARBLE} stroke={C.marbleShade} strokeWidth=".8" />)}
    <rect x="6" y="64" width="84" height="5" fill={C.marbleMid} stroke={C.marbleShade} />
    <rect x="2" y="69" width="92" height="5" fill={MARBLE} stroke={C.marbleShade} />
  </g>
));

const brokenColumn = piece(56, 84, (
  <g>
    <rect x="6" y="76" width="30" height="8" rx="1" fill={C.marbleMid} stroke={C.marbleShade} />
    <path d="M10 76 V22 L14 16 L19 21 L24 13 L28 19 L32 15 V76 Z" fill={MARBLE} stroke={C.marbleShade} />
    {[15, 21, 27].map((x) => <line key={x} x1={x} y1="24" x2={x} y2="74" stroke={C.marbleShade} strokeWidth="1" />)}
    <path d="M36 84 L40 72 H54 L56 84 Z" fill={C.marbleMid} stroke={C.marbleShade} />
  </g>
));

const tent = piece(76, 58, (
  <g>
    <path d="M6 56 L38 8 L70 56 Z" fill={C.canvas} stroke={C.canvasShade} />
    <path d="M38 8 L54 56 H70 Z" fill={C.canvasShade} opacity=".7" />
    <path d="M38 22 L30 56 H46 Z" fill="#8a7458" />
    <path d="M14 46 H62" stroke={C.terracotta} strokeWidth="3" />
    <line x1="38" y1="2" x2="38" y2="10" stroke={C.bark} strokeWidth="2" />
  </g>
));

const standard = piece(40, 96, (
  <g>
    <rect x="19" y="8" width="2.6" height="88" fill={C.bark} />
    <path d="M8 26 H32" stroke={C.goldDark} strokeWidth="2.2" />
    <rect x="10" y="27" width="20" height="24" fill={C.red} />
    <path d="M10 51 l2.5 4 2.5 -4 2.5 4 2.5 -4 2.5 4 2.5 -4 2.5 4 2.5 -4" fill="none" stroke={C.gold} strokeWidth="1.6" />
    <text x="20" y="43" textAnchor="middle" fontFamily="Cinzel, serif" fontSize="7" fontWeight="700" fill="#f4d88a">SPQR</text>
    <circle cx="20" cy="10" r="6" fill="none" stroke={C.gold} strokeWidth="2.2" />
    <circle cx="20" cy="10" r="2" fill={C.gold} />
  </g>
));

const promontory = piece(110, 64, (
  <g>
    <path d="M44 56 L52 18 L64 10 L74 22 L86 30 L96 56 Z" fill="#d6d0c4" stroke="#bdb5a6" />
    <path d="M52 18 L64 10 L62 30 L54 40 Z" fill="#e6e1d7" />
    {[[6, 50], [18, 58], [2, 62], [30, 60]].map(([x, y], i) => (
      <path key={i} d={`M${x} ${y} q6 -6 12 0 q6 6 12 0`} fill="none" stroke={i % 2 ? C.seaDark : C.sea} strokeWidth="2.4" strokeLinecap="round" />
    ))}
    <path d="M36 50 q5 -8 10 -2" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M96 60 q6 -5 12 0" fill="none" stroke={C.sea} strokeWidth="2.4" strokeLinecap="round" />
  </g>
));

const sunrise = piece(100, 58, (
  <g>
    {Array.from({ length: 7 }, (_, i) => {
      const a = Math.PI + (i + 1) * (Math.PI / 8);
      return <line key={i} x1={50 + 25 * Math.cos(a)} y1={44 + 25 * Math.sin(a)} x2={50 + 34 * Math.cos(a)} y2={44 + 34 * Math.sin(a)} stroke="#f2b45f" strokeWidth="3" strokeLinecap="round" />;
    })}
    <path d="M30 44 A20 20 0 0 1 70 44 Z" fill="url(#roman-sun)" />
    <path d="M0 58 C18 40 34 44 50 50 C66 42 84 40 100 58 Z" fill={C.olive} />
    <path d="M0 58 C24 48 40 52 56 58 Z" fill={C.oliveDark} />
  </g>
));

const stars = piece(90, 70, (
  <g>
    {[[18, 22, 7], [58, 12, 5], [74, 40, 6], [38, 52, 4]].map(([x, y, r], i) => (
      <path key={i} d={`M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`} fill={i % 2 ? "#9db4e8" : C.gold} />
    ))}
    <path d="M44 20 A12 12 0 1 0 56 36 A9 9 0 1 1 44 20 Z" fill="#e8c86a" />
  </g>
));

const amphora = piece(36, 58, (
  <g>
    <path d="M14 4 H22 V10 C34 16 34 38 22 52 L18 58 L14 52 C2 38 2 16 14 10 Z" fill={C.terracotta} />
    <path d="M14 10 C8 16 6 30 10 42 C4 30 6 16 14 10 Z" fill="#e09a74" />
    <path d="M14 12 C6 12 6 22 10 24 M22 12 C30 12 30 22 26 24" fill="none" stroke={C.terracottaDark} strokeWidth="2.4" strokeLinecap="round" />
    <path d="M9 28 H27" stroke={C.terracottaDark} strokeWidth="1.6" />
  </g>
));

const brazier = piece(46, 70, (
  <g>
    <path d="M10 70 L20 40 M36 70 L26 40 M23 70 V40" stroke={C.bark} strokeWidth="2.6" strokeLinecap="round" />
    <path d="M6 32 H40 L34 42 H12 Z" fill={C.goldDark} />
    <path d="M23 4 C32 14 34 22 28 32 H18 C12 22 16 14 23 4 Z" fill="#f2a65a" />
    <path d="M23 14 C28 20 28 26 25 32 H21 C18 26 19 20 23 14 Z" fill="#f8d17a" />
  </g>
));

const citadel = piece(96, 72, (
  <g>
    <path d="M4 72 V34 h8 v-6 h8 v6 h8 v-6 h8 v6 h4 V72 Z" fill="#e3ddd1" stroke={C.marbleShade} />
    <path d="M40 72 V14 h6 v-6 h6 v6 h6 v-6 h6 v6 h6 V72 Z" fill={MARBLE} stroke={C.marbleShade} />
    <path d="M76 72 V34 h6 v-6 h6 v6 h6 V72 Z" fill="#e3ddd1" stroke={C.marbleShade} />
    <path d="M50 72 V54 A6 6 0 0 1 62 54 V72 Z" fill="#8a7458" />
    <rect x="54" y="26" width="4" height="9" rx="2" fill="#8a7458" />
    <line x1="56" y1="8" x2="56" y2="-6" stroke={C.bark} strokeWidth="1.6" />
    <path d="M56 -6 h10 l-3 4 3 4 h-10 Z" fill={C.red} />
  </g>
));

const scales = piece(66, 70, (
  <g>
    <rect x="31" y="10" width="4" height="54" fill={C.goldDark} />
    <rect x="20" y="64" width="26" height="6" rx="2" fill={C.goldDark} />
    <path d="M8 16 H58" stroke={C.goldDark} strokeWidth="3" strokeLinecap="round" />
    <circle cx="33" cy="9" r="4" fill={C.gold} />
    {[12, 54].map((x) => (
      <g key={x}>
        <path d={`M${x} 16 L${x - 9} 38 M${x} 16 L${x + 9} 38`} stroke={C.goldDark} strokeWidth="1.2" />
        <path d={`M${x - 11} 38 H${x + 11} A11 6 0 0 1 ${x - 11} 38 Z`} fill={C.gold} />
      </g>
    ))}
  </g>
));

const masks = piece(82, 58, (
  <g>
    <g transform="rotate(-12 26 30)">
      <path d="M8 10 C8 40 16 54 26 54 C36 54 44 40 44 10 C34 4 18 4 8 10 Z" fill={MARBLE} stroke={C.marbleShade} />
      <path d="M15 22 q4 -4 8 0 M29 22 q4 -4 8 0" stroke={C.ink} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M17 36 q9 9 18 0" stroke={C.ink} strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </g>
    <g transform="rotate(12 56 30)">
      <path d="M38 10 C38 40 46 54 56 54 C66 54 74 40 74 10 C64 4 48 4 38 10 Z" fill="#e8d3b0" stroke={C.canvasShade} />
      <path d="M45 24 q4 4 8 0 M59 24 q4 4 8 0" stroke={C.ink} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M47 42 q9 -9 18 0" stroke={C.ink} strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </g>
  </g>
));

const laurelBranch = piece(60, 60, (
  <g>
    <path d="M6 56 C20 40 34 26 54 6" stroke={C.laurelDark} strokeWidth="2" fill="none" strokeLinecap="round" />
    {Array.from({ length: 6 }, (_, i) => {
      const t = 0.12 + i * 0.15, x = 6 + 48 * t, y = 56 - 50 * t;
      return (
        <g key={i}>
          <ellipse cx={x - 6} cy={y - 3} rx="6" ry="2.6" transform={`rotate(-70 ${x - 6} ${y - 3})`} fill={C.laurel} />
          <ellipse cx={x + 5} cy={y + 3} rx="6" ry="2.6" transform={`rotate(10 ${x + 5} ${y + 3})`} fill={C.laurelDark} />
        </g>
      );
    })}
  </g>
));

/** Scenery chosen for a specific book, chapter by chapter, from what each chapter talks about. */
const BY_BOOK: Record<string, Record<number, Decor[]>> = {
  meditations: {
    1: [olive, temple, cypress(), amphora],                          // family, teachers, home in Rome
    2: [tent, standard, cypress(0.85), tent],                         // "Whilst I was at Carnuntum": on campaign
    3: [brazier, brokenColumn, cypress(), laurelBranch],              // the guiding spirit within; life wastes daily
    4: [promontory, cypress(0.9), olive, promontory],                 // the inner retreat; "like a promontory"
    5: [sunrise, olive, cypress(0.85), amphora],                      // rising to the work of a man
    6: [stars, brokenColumn, stars, cypress()],                       // the one fabric of the universe
    7: [laurelBranch, brokenColumn, amphora, cypress(0.9)],           // the wrestler's art
    8: [citadel, standard, cypress(), citadel],                       // the mind as a citadel
    9: [scales, temple, cypress(0.9), olive],                         // justice and the gods
    10: [olive, cypress(), brazier, laurelBranch],                    // good, modest, true
    11: [olive, cypress(0.9), olive, stars],                          // the branch and the tree; the Pythagoreans' sky
    12: [masks, brokenColumn, stars, cypress()],                      // three acts is the whole play
  },
};

/** Any other book on the Roman road gets a rotation of these. */
const ROTATION: Decor[][] = [
  [olive, temple, cypress(), amphora],
  [tent, standard, cypress(0.85), brazier],
  [promontory, cypress(0.9), olive, brokenColumn],
  [citadel, laurelBranch, cypress(), scales],
  [sunrise, olive, masks, cypress(0.9)],
  [stars, brokenColumn, amphora, cypress()],
];

export function scenery(ch: ChapterView, book: BookSummary): Decor[] {
  return BY_BOOK[book.slug]?.[ch.position] ?? ROTATION[(ch.position - 1) % ROTATION.length];
}
