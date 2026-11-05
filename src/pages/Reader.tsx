import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Flame, X, Zap } from "lucide-react";
import type { CompleteResult, MicroDetail } from "../../shared/types";
import { api, useApi } from "../api";
import { useMe } from "../me";
import { roman } from "../format";
import { ErrorState, Loading, nextHref } from "../components/ui";
import { PageCurl, easeInOutCubic, easeOutCubic, easeOutQuad, type Mode } from "../components/pageCurl";

// ------------------------------------------------------------------ preferences
const SIZES = [16, 18, 20, 22, 24];
type Theme = "white" | "paper";
type Prefs = { size: number; theme: Theme };
const PREFS_KEY = "tb:reader";
function loadPrefs(): Prefs {
  try { const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? ""); if (SIZES.includes(p.size)) return p; } catch { /* default */ }
  return { size: window.innerWidth < 400 ? 18 : 20, theme: "white" };
}
function savePrefs(p: Prefs) { try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* private mode */ } }
const posKey = (id: string) => `tb:pos:${id}`;
function loadPos(id: string): number { try { return Number(sessionStorage.getItem(posKey(id))) || 0; } catch { return 0; } }
function savePos(id: string, ratio: number) { try { sessionStorage.setItem(posKey(id), String(ratio)); } catch { /* ignore */ } }

const GAP = 56;                       // gap between text columns (never visible)
const PAD_TOP = 34, PAD_BOTTOM = 10;  // page margins above and below the text
const TURN_MS = 620;                  // a full tap-turn
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** One sheet's worth of text: the chapter laid out in columns, shifted to show a single page. */
const PageBody = memo(function PageBody({ flowRef, text, w, h }: { flowRef: React.RefObject<HTMLDivElement | null>; text: React.ReactNode; w: number; h: number }) {
  return (
    <div className="k-pagebody">
      <div className="k-window" style={{ width: w, height: h }}>
        <div className="k-flow" ref={flowRef} style={{ width: w, height: h, columnWidth: w, columnGap: GAP }}>{text}</div>
      </div>
      <span className="k-gutter" />
    </div>
  );
});

export default function Reader() {
  const { id = "" } = useParams();
  const { data, error } = useApi<MicroDetail>(`/micro/${id}`);
  const { reloadMe } = useMe();
  const nav = useNavigate();

  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [chrome, setChrome] = useState(false);
  const [settings, setSettings] = useState(false);
  const [page, setPage] = useState(0);
  const [count, setCount] = useState(0);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [result, setResult] = useState<CompleteResult | null>(null);
  const [busy, setBusy] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const underRef = useRef<HTMLDivElement>(null);
  const maskRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const flapRef = useRef<HTMLDivElement>(null);
  const shadeRef = useRef<HTMLDivElement>(null);
  const castRef = useRef<HTMLDivElement>(null);
  const measureFlow = useRef<HTMLDivElement>(null);
  const underFlow = useRef<HTMLDivElement>(null);
  const frontFlow = useRef<HTMLDivElement>(null);
  const flapFlow = useRef<HTMLDivElement>(null);
  const curlRef = useRef<PageCurl | null>(null);

  const pageRef = useRef(0);
  const countRef = useRef(0);
  const stepRef = useRef(1);
  const paginatedId = useRef<string | null>(null);
  const layoutRef = useRef("");
  const settingsRef = useRef(false);
  pageRef.current = page; countRef.current = count; settingsRef.current = settings;

  useEffect(() => { savePrefs(prefs); }, [prefs]);
  useEffect(() => { setResult(null); setChrome(false); setSettings(false); }, [id]);

  // ---------------------------------------------------------------- sizes
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      setStage({ w: el.clientWidth, h: Math.floor(el.clientHeight - parseFloat(cs.paddingTop)) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [data]);

  const margin = stage.w < 520 ? 26 : 56;
  const pageW = Math.min(stage.w, 720);
  const textW = Math.max(0, Math.min(pageW - margin * 2, 600));
  const textH = Math.max(0, stage.h - PAD_TOP - PAD_BOTTOM);
  const ready = !!data && textW > 0 && textH > 0;
  stepRef.current = textW + GAP;

  // ---------------------------------------------------------------- pages on the three sheets
  const show = useCallback((flow: HTMLDivElement | null, p: number) => {
    if (flow) flow.style.transform = `translate3d(${-p * stepRef.current}px,0,0)`;
  }, []);

  /** At rest: only the page you're reading. */
  const rest = useCallback((p: number) => {
    curlRef.current?.end();
    show(underFlow.current, p);
  }, [show]);

  /** Put the right pages on each sheet for a turn. */
  const prepare = useCallback((mode: Mode) => {
    const p = pageRef.current;
    if (mode === "fwd") { show(underFlow.current, p + 1); show(frontFlow.current, p); show(flapFlow.current, p); }
    else { show(underFlow.current, p); show(frontFlow.current, p - 1); show(flapFlow.current, p - 1); }
  }, [show]);

  const commit = useCallback((p: number) => {
    pageRef.current = p;
    setPage(p);
    rest(p);
    const n = countRef.current;
    if (n > 1) savePos(id, p / (n - 1));
  }, [rest, id]);

  // ---------------------------------------------------------------- the curl engine
  useLayoutEffect(() => {
    if (!ready) return;
    const els = { under: underRef.current, mask: maskRef.current, front: frontRef.current, flap: flapRef.current, shade: shadeRef.current, cast: castRef.current };
    if (!els.under || !els.mask || !els.front || !els.flap || !els.shade || !els.cast) return;
    const curl = new PageCurl({ under: els.under, mask: els.mask, front: els.front, flap: els.flap, shade: els.shade, cast: els.cast });
    curlRef.current = curl;
    return () => { curl.end(); curlRef.current = null; };
  }, [ready]);

  useLayoutEffect(() => {
    curlRef.current?.setSize(pageW, stage.h);
  }, [ready, pageW, stage.h]);

  // ---------------------------------------------------------------- pagination
  useLayoutEffect(() => {
    const f = measureFlow.current;
    if (!f || !ready) return;
    let cancelled = false;
    const layout = `${textW}x${textH}@${prefs.size}`;
    const paginate = () => {
      if (cancelled) return;
      const n = Math.max(1, Math.round((f.scrollWidth + GAP) / (textW + GAP)));
      const fresh = paginatedId.current !== id;
      // Nothing moved (e.g. the web fonts finished loading with identical metrics): leave the page,
      // and any turn in progress, alone.
      if (!fresh && n === countRef.current && layoutRef.current === layout) return;
      layoutRef.current = layout;
      curlRef.current?.finishNow();
      paginatedId.current = id;
      const ratio = fresh || countRef.current <= 1 ? loadPos(id) : pageRef.current / (countRef.current - 1);
      const p = Math.min(n - 1, Math.round(ratio * (n - 1)));
      pageRef.current = p; countRef.current = n;
      setCount(n); setPage(p); rest(p);
    };
    paginate();
    void document.fonts?.ready.then(paginate);
    return () => { cancelled = true; };
  }, [ready, textW, textH, prefs.size, data, id, rest]);

  // ---------------------------------------------------------------- turning
  const peeking = useRef(false);

  const next = useCallback(() => {
    const curl = curlRef.current;
    if (!curl) return;
    if (!peeking.current) curl.finishNow();
    const p = pageRef.current;
    if (p >= countRef.current - 1) return;
    if (!peeking.current || !curl.active) { prepare("fwd"); curl.begin("fwd", true); }
    peeking.current = false;
    curl.animateTo(-curl.W, 0, reducedMotion() ? 0 : TURN_MS, easeInOutCubic, () => commit(p + 1));
  }, [prepare, commit]);

  const prev = useCallback(() => {
    const curl = curlRef.current;
    if (!curl) return;
    curl.finishNow();
    const p = pageRef.current;
    if (p <= 0) return;
    peeking.current = false;
    prepare("back"); curl.begin("back", true);
    curl.animateTo(curl.W, 0, reducedMotion() ? 0 : TURN_MS, easeInOutCubic, () => commit(p - 1));
  }, [prepare, commit]);

  const jump = useCallback((p: number) => {
    curlRef.current?.finishNow();
    peeking.current = false;
    commit(clamp(p, 0, countRef.current - 1));
  }, [commit]);

  // ---------------------------------------------------------------- touch, pen and mouse
  useEffect(() => {
    const stageEl = stageRef.current, sheet = sheetRef.current;
    if (!ready || !stageEl || !sheet) return;

    let down = false, dragging = false, id0 = -1;
    let x0 = 0, y0 = 0, t0 = 0, xStart = 0, yBase = 0, gain = 1;
    let mode: Mode = "fwd";
    let samples: { t: number; x: number }[] = [];
    let frame = 0, pending: { x: number; y: number } | null = null;

    const local = (e: PointerEvent) => { const r = sheet.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const flush = () => { frame = 0; if (pending) { curlRef.current?.set(pending.x, pending.y); pending = null; } };
    const schedule = (x: number, y: number) => { pending = { x, y }; if (!frame) frame = requestAnimationFrame(flush); };
    const cancelFrame = () => { if (frame) cancelAnimationFrame(frame); frame = 0; pending = null; };

    const onDown = (e: PointerEvent) => {
      if (down || (e.target as Element).closest("button, a, input")) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const curl = curlRef.current;
      if (curl?.animating && !peeking.current) curl.finishNow();
      down = true; dragging = false; id0 = e.pointerId;
      const p = local(e);
      x0 = p.x; y0 = p.y; t0 = performance.now();
      samples = [{ t: t0, x: p.x }];
    };

    const onMove = (e: PointerEvent) => {
      const curl = curlRef.current;
      if (!curl) return;
      const p = local(e);

      // Mouse hovering near the bottom-right corner: lift the corner a little, like a real page.
      if (!down) {
        if (e.pointerType !== "mouse") return;
        const near = p.x > curl.W - 90 && p.x <= curl.W && p.y > curl.H - 120 && p.y <= curl.H && pageRef.current < countRef.current - 1;
        if (near && !peeking.current && !curl.active) {
          peeking.current = true;
          prepare("fwd"); curl.begin("fwd", true);
          curl.animateTo(curl.W - 58, -8, 300, easeOutCubic, () => {});
        } else if (!near && peeking.current && !curl.animating) {
          peeking.current = false;
          curl.animateTo(curl.W, 0, 220, easeOutQuad, () => rest(pageRef.current));
        }
        return;
      }
      if (e.pointerId !== id0) return;

      const dx = p.x - x0, dy = p.y - y0;
      if (!dragging) {
        if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy) * 0.8) return;
        const pg = pageRef.current;
        if (dx < 0 && pg < countRef.current - 1) mode = "fwd";
        else if (dx > 0 && pg > 0) mode = "back";
        else return;
        if (mode === "fwd" && peeking.current && curl.active) { curl.finishNow(); yBase = curl.yOff; }
        else { if (curl.active) curl.end(); prepare(mode); curl.begin(mode, y0 > curl.H * 0.5); yBase = 0; }
        peeking.current = false;
        xStart = curl.x;
        // The corner travels a bit faster than the finger when you grab further from the edge,
        // so a drag across the screen always turns the page.
        const reach = mode === "fwd" ? x0 : curl.W - x0;
        gain = clamp((1.35 * curl.W) / Math.max(reach, 40), 1.3, 2.4);
        dragging = true;
        stageEl.setPointerCapture?.(e.pointerId);
      }
      // The page was reset under us (re-pagination): drop this drag.
      if (!curl.active) { dragging = false; down = false; cancelFrame(); return; }
      const x = mode === "fwd" ? xStart - (x0 - p.x) * gain : xStart + (p.x - x0) * gain;
      schedule(x, yBase + dy * 0.6);
      const now = performance.now();
      samples.push({ t: now, x: p.x });
      while (samples.length > 2 && now - samples[0].t > 100) samples.shift();
    };

    const onUp = (e: PointerEvent) => {
      if (!down || e.pointerId !== id0) return;
      down = false;
      const curl = curlRef.current;
      if (!curl) return;
      const p = local(e);
      if (dragging) {
        dragging = false;
        cancelFrame();
        if (!curl.active) return;
        const now = performance.now();
        samples.push({ t: now, x: p.x });
        const s0 = samples[0];
        const vx = (p.x - s0.x) / Math.max(1, now - s0.t);  // px per ms; negative = moving left
        const t = curl.t;
        const pg = pageRef.current;
        const fwd = mode === "fwd";
        const go = fwd ? vx < -0.35 || (t > 0.3 && vx < 0.3) : vx > 0.35 || (t < 0.7 && vx > -0.3);
        const target = fwd === go ? -curl.W : curl.W;
        const remaining = Math.abs(target - curl.x) / (2 * curl.W);
        const speed = Math.abs(vx);
        const dur = reducedMotion() ? 0 : clamp(speed > 0.35 ? (remaining * 560) / (0.6 + speed) : remaining * 620 + 90, 110, 560);
        curl.animateTo(target, 0, dur, easeOutCubic, () => (go ? commit(fwd ? pg + 1 : pg - 1) : rest(pg)));
        return;
      }
      // A tap: right side forward, left side back, middle shows the controls.
      const moved = Math.hypot(p.x - x0, p.y - y0);
      if (moved > 10 || performance.now() - t0 > 500) return;
      if (settingsRef.current) { setSettings(false); return; }
      const r = stageEl.getBoundingClientRect();
      const fx = (e.clientX - r.left) / r.width;
      if (fx > 0.7) next();
      else if (fx < 0.3) prev();
      else setChrome((c) => !c);
    };

    const onCancel = (e: PointerEvent) => {
      if (!down || e.pointerId !== id0) return;
      down = false;
      const curl = curlRef.current;
      if (dragging && curl) {
        dragging = false; cancelFrame();
        const pg = pageRef.current;
        curl.animateTo(mode === "fwd" ? curl.W : -curl.W, 0, 260, easeOutCubic, () => rest(pg));
      }
    };

    const onLeave = () => {
      const curl = curlRef.current;
      if (peeking.current && curl && !down) {
        peeking.current = false;
        curl.animateTo(curl.W, 0, 220, easeOutQuad, () => rest(pageRef.current));
      }
    };

    stageEl.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    stageEl.addEventListener("pointerleave", onLeave);
    return () => {
      cancelFrame();
      stageEl.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      stageEl.removeEventListener("pointerleave", onLeave);
    };
  }, [ready, prepare, commit, rest, next, prev]);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); prev(); }
      if (e.key === "Escape") nav("/");
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [next, prev, nav]);

  // ---------------------------------------------------------------- content
  const finishRef = useRef<() => void>(() => {});
  const text = useMemo(() => data && (
    <>
      <div className="k-opening">
        <small>Book {roman(data.chapter.position)} · {data.chapter.title}</small>
        <h1>{data.title}</h1>
        <span className="k-rule" />
      </div>
      {data.content.map((s, si) => (
        <section key={s.n} className="k-passage">
          <span className="k-n">{s.n}</span>
          {s.paras.map((p, i) => <p key={i} className={si === 0 && i === 0 ? "k-first" : undefined}>{p}</p>)}
        </section>
      ))}
      {data.footer && <p className="k-colophon">{data.footer}</p>}
      <section className="k-end" style={{ height: textH }}>
        <svg viewBox="0 0 80 40" width="64" height="32" aria-hidden className="k-orn">
          <path d="M40 34 C26 32 16 24 12 8 M40 34 C54 32 64 24 68 8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          {[0, 1, 2, 3].map((i) => {
            const t = 0.2 + i * 0.22, x = 12 + 28 * t * t, y = 8 + 26 * (1 - (1 - t) * (1 - t));
            return <g key={i} fill="currentColor"><ellipse cx={x - 3} cy={y - 2} rx="4" ry="1.7" transform={`rotate(-35 ${x - 3} ${y - 2})`} /><ellipse cx={80 - x + 3} cy={y - 2} rx="4" ry="1.7" transform={`rotate(35 ${80 - x + 3} ${y - 2})`} /></g>;
          })}
        </svg>
        <p className="k-end-label">End of</p>
        <h2>{data.title}</h2>
        {!data.done && <p className="k-end-xp"><Zap size={15} fill="currentColor" className="inline" /> +10 XP</p>}
        <button className="btn primary k-finish" onClick={() => finishRef.current()}>{data.done ? "Back to the road" : "Finish"}</button>
      </section>
    </>
  ), [data, textH]);

  if (error) return <div className="focus"><ErrorState message={error.message} action={<Link className="btn" to="/">Back</Link>} /></div>;
  if (!data) return <div className={`kindle theme-${prefs.theme}`}><Loading /></div>;

  finishRef.current = async () => {
    if (busy) return;
    if (data.done) { nav("/"); return; }
    setBusy(true);
    try { setResult(await api<CompleteResult>(`/micro/${data.id}/complete`, { method: "POST" })); savePos(id, 0); void reloadMe(); }
    finally { setBusy(false); }
  };

  const minsLeft = Math.max(0, Math.ceil(data.minutes * (1 - (count > 1 ? page / (count - 1) : 1))));
  const timeLeft = page >= count - 1 ? "End of chapter" : minsLeft <= 1 ? "Less than a minute left" : `${minsLeft} min left in chapter`;
  const sheetSize = { width: pageW, height: stage.h };

  return (
    <div className={`kindle theme-${prefs.theme} ${chrome ? "show-chrome" : ""} ${textW < 480 ? "narrow" : ""} ${stage.w > pageW ? "on-desk" : ""}`}
      style={{ "--fs": `${prefs.size}px`, "--pad-top": `${PAD_TOP}px` } as React.CSSProperties}>
      <div className="k-stage" ref={stageRef}>
        {ready && (
          <div className="k-sheet" ref={sheetRef} style={sheetSize}>
            {/* the page you're on, or the one being uncovered */}
            <div className="k-under" ref={underRef} style={sheetSize}>
              <PageBody flowRef={underFlow} text={text} w={textW} h={textH} />
              <div className="k-cast" ref={castRef} />
            </div>
            {/* the sheet being turned: its flat part, and its back folded over */}
            <div className="k-mask" ref={maskRef} aria-hidden>
              <div className="k-front" ref={frontRef} style={sheetSize}>
                <PageBody flowRef={frontFlow} text={text} w={textW} h={textH} />
              </div>
              <div className="k-flap" ref={flapRef} style={sheetSize}>
                <PageBody flowRef={flapFlow} text={text} w={textW} h={textH} />
                <div className="k-flap-shade" ref={shadeRef} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* off-screen: the chapter in one long column flow, to find the page breaks */}
      {ready && (
        <div className="k-offstage" aria-hidden>
          <div className="k-flow" ref={measureFlow} style={{ width: textW, height: textH, columnWidth: textW, columnGap: GAP }}>{text}</div>
        </div>
      )}

      <footer className="k-foot">
        <input className="k-scrub" type="range" min={0} max={Math.max(0, count - 1)} value={page}
          onChange={(e) => jump(Number(e.target.value))} aria-label="Page" />
        <div className="k-foot-row">
          <Link to="/" className="k-icon" aria-label="Close"><X size={20} /></Link>
          <span className="k-left">{timeLeft}</span>
          <span className="k-count">{count ? `${page + 1} / ${count}` : ""}</span>
          <button className="k-icon k-aa" onClick={() => setSettings((s) => !s)} aria-label="Text settings">Aa</button>
        </div>
        <div className="k-progress"><div style={{ transform: `scaleX(${count > 1 ? page / (count - 1) : 1})` }} /></div>
      </footer>

      {settings && (
        <div className="k-sheet-settings" role="dialog" aria-label="Text settings">
          <div className="k-sizes">
            <button className="k-size small" disabled={prefs.size === SIZES[0]} onClick={() => setPrefs((p) => ({ ...p, size: SIZES[Math.max(0, SIZES.indexOf(p.size) - 1)] }))}>A</button>
            <div className="k-dots">{SIZES.map((s) => <span key={s} className={s <= prefs.size ? "on" : ""} />)}</div>
            <button className="k-size big" disabled={prefs.size === SIZES[SIZES.length - 1]} onClick={() => setPrefs((p) => ({ ...p, size: SIZES[Math.min(SIZES.length - 1, SIZES.indexOf(p.size) + 1)] }))}>A</button>
          </div>
          <div className="k-themes">
            {(["white", "paper"] as Theme[]).map((t) => (
              <button key={t} className={`k-theme t-${t} ${prefs.theme === t ? "on" : ""}`} onClick={() => setPrefs((p) => ({ ...p, theme: t }))}>{t === "white" ? "White" : "Paper"}</button>
            ))}
          </div>
        </div>
      )}

      {result && (
        <div className="sheet-backdrop">
          <div className="sheet center" role="dialog" aria-modal>
            <div className="big-num"><Zap size={34} fill="currentColor" className="inline" /> +{result.xp} XP</div>
            <p className="muted"><Flame size={16} className="inline" color="var(--flame)" /> {result.stats.streak}-day streak</p>
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              <button className="btn primary block" onClick={() => nav(result.next ? nextHref(result.next) : "/")}>Continue</button>
              <Link to="/" className="btn text">Back to the road</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
