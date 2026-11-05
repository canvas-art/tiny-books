// A single-page paper curl for touch screens.
//
// Geometry: the page is hinged at its left edge. The free corner C (bottom-right or top-right) is pulled
// to a point P. The fold line is the perpendicular bisector of C→P; everything on the corner side of it
// is lifted and reflected across it (that is the flap, the back of the sheet).
//
// Rendering: only GPU transforms change per frame, nothing is re-laid-out or re-painted.
//  - `under`  : the page being revealed, flat.
//  - `mask`   : a huge box rotated so one edge lies on the fold line, with overflow hidden. It clips its
//               children to the non-corner side of the fold. Inside it:
//      `front`: the turning page, counter-transformed so it stays in place (shows its flat part).
//      `flap` : the back of the turning page, transformed by the reflection across the fold.
//  - `shade`  : curvature shading on the flap; `cast`: the flap's shadow on the revealed page.

type Pt = { x: number; y: number };
type Mat = [number, number, number, number, number, number]; // CSS matrix(a, b, c, d, e, f)

const mul = (A: Mat, B: Mat): Mat => [
  A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1],
  A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3],
  A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5],
];
const inv = (m: Mat): Mat => {
  const [a, b, c, d, e, f] = m;
  const det = a * d - b * c;
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
};
const css = (m: Mat) => `matrix(${m.map((v) => +v.toFixed(5)).join(",")})`;
const scaleY = (s: number): Mat => [1, 0, 0, s, 0, 0];
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);

export type CurlEls = {
  under: HTMLElement; mask: HTMLElement; front: HTMLElement; flap: HTMLElement; shade: HTMLElement; cast: HTMLElement;
};
export type Mode = "fwd" | "back";

const LIFT = 0.055;   // how much the corner rises (fraction of height) mid-turn

export class PageCurl {
  W = 1; H = 1;
  mode: Mode = "fwd";
  bottom = true;
  /** Corner position along x: W = flat (unturned), -W = turned away completely. */
  x = 1;
  /** Vertical offset of the corner from its resting place. */
  yOff = 0;
  active = false;
  private raf = 0;
  private anim: null | { done: () => void; toX: number; toY: number } = null;

  constructor(private els: CurlEls) {}

  setSize(W: number, H: number) {
    this.W = W; this.H = H;
    const S = Math.hypot(W, H) * 1.7;
    const { mask, shade, cast } = this.els;
    mask.style.width = `${2 * S}px`;
    mask.style.height = `${S}px`;
    shade.style.width = `${2 * S}px`;
    cast.style.width = `${2 * S}px`;
    this.S = S;
    if (this.active) this.render();
  }
  private S = 1;

  /** Progress of the turn, 0 (flat) to 1 (turned away). */
  get t() { return clamp((this.W - this.x) / (2 * this.W), 0, 1); }

  begin(mode: Mode, bottom: boolean) {
    this.stopAnim();
    this.mode = mode; this.bottom = bottom; this.active = true;
    this.x = mode === "fwd" ? this.W : -this.W;
    this.yOff = 0;
    this.els.mask.style.opacity = "1";
    this.render();
  }

  end() {
    this.stopAnim();
    this.active = false;
    // Hidden, not removed: the layers (and their text) stay drawn, so the next turn starts instantly.
    this.els.mask.style.opacity = "0";
    this.els.cast.style.opacity = "0";
  }

  /** Move the corner (x along the turn, y offset from rest) and redraw. */
  set(x: number, yOff: number) {
    this.x = clamp(x, -this.W, this.W);
    this.yOff = yOff;
    this.render();
  }

  animateTo(toX: number, toY: number, duration: number, ease: (t: number) => number, done: () => void) {
    this.stopAnim();
    if (duration <= 0) { this.set(toX, toY); done(); return; }
    const x0 = this.x, y0 = this.yOff, t0 = performance.now();
    this.anim = { done, toX, toY };
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / duration);
      const e = ease(k);
      this.set(x0 + (toX - x0) * e, y0 + (toY - y0) * e);
      if (k < 1) this.raf = requestAnimationFrame(step);
      else { const a = this.anim; this.anim = null; this.raf = 0; a?.done(); }
    };
    this.raf = requestAnimationFrame(step);
  }

  get animating() { return this.anim !== null; }

  /** Jump a running animation to its end (so a quick second tap never waits). */
  finishNow() {
    const a = this.anim;
    if (!a) return;
    cancelAnimationFrame(this.raf);
    this.raf = 0; this.anim = null;
    this.set(a.toX, a.toY);
    a.done();
  }

  private stopAnim() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0; this.anim = null;
  }

  render() {
    const { W, H, S, els } = this;
    const C: Pt = { x: W, y: this.bottom ? H : 0 };
    const t = this.t;
    const lift = (this.bottom ? -1 : 1) * Math.sin(Math.PI * t) * H * LIFT;
    let P: Pt = { x: this.x, y: C.y + this.yOff + lift };

    // The sheet stays attached along its left edge: the corner can't get further from the near hinge
    // point than the page width, nor further from the far one than the diagonal.
    const near: Pt = { x: 0, y: C.y }, far: Pt = { x: 0, y: this.bottom ? 0 : H };
    const diag = Math.hypot(W, H);
    let r = Math.hypot(P.x - near.x, P.y - near.y);
    if (r > W) P = { x: near.x + (P.x - near.x) * (W / r), y: near.y + (P.y - near.y) * (W / r) };
    r = Math.hypot(P.x - far.x, P.y - far.y);
    if (r > diag) P = { x: far.x + (P.x - far.x) * (diag / r), y: far.y + (P.y - far.y) * (diag / r) };

    let dx = C.x - P.x, dy = C.y - P.y;
    let len = Math.hypot(dx, dy);
    if (len < 0.6) { dx = 0.5; dy = this.bottom ? 0.33 : -0.33; len = Math.hypot(dx, dy); P = { x: C.x - dx, y: C.y - dy }; }
    const dn: Pt = { x: dx / len, y: dy / len };                 // fold normal, pointing to the corner
    const n: Pt = { x: -dn.x, y: -dn.y };                        // pointing away from the corner
    const u: Pt = { x: n.y, y: -n.x };                           // along the fold line
    const M: Pt = { x: (C.x + P.x) / 2, y: (C.y + P.y) / 2 };    // a point on the fold line
    const depth = len / 2;                                       // how far the flap reaches from the fold

    // The clip edge sits a hair past the fold so the two sides overlap and no seam shows.
    const SEAM = 0.8;
    const A: Mat = [u.x, u.y, n.x, n.y, M.x - S * u.x - SEAM * n.x, M.y - S * u.y - SEAM * n.y];
    const Ai = inv(A);
    const k = M.x * dn.x + M.y * dn.y;
    const R: Mat = [1 - 2 * dn.x * dn.x, -2 * dn.x * dn.y, -2 * dn.x * dn.y, 1 - 2 * dn.y * dn.y, 2 * k * dn.x, 2 * k * dn.y];
    const toCorner: Mat = [u.x, u.y, dn.x, dn.y, M.x - S * u.x, M.y - S * u.y];

    els.mask.style.transform = css(A);
    els.front.style.transform = css(Ai);
    els.flap.style.transform = css(mul(Ai, R));
    els.shade.style.transform = css(mul(toCorner, scaleY(Math.max(depth, 1) / 100)));
    const castLen = Math.min(depth * 0.85, 150);
    els.cast.style.transform = css(mul(toCorner, scaleY(Math.max(castLen, 1) / 100)));
    // The shadow is deepest mid-turn and fades as the sheet lies down on either side.
    els.cast.style.opacity = Math.min(1, Math.sin(Math.PI * t) * 1.6 + 0.15).toFixed(3);
  }
}
