// The path engine: lays out a book as a winding road and draws it with a theme.
// Nothing in here knows what the road looks like; see types.ts for the theme contract.

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { useNavigate } from "react-router";
import type { BookSummary, ChapterView } from "../../shared/types";
import type { LoadedTheme } from "./types";
import { layoutChapter } from "./layout";

export default function Path({ book, chapters, theme }: { book: BookSummary; chapters: ChapterView[]; theme: LoadedTheme }) {
  const [open, setOpen] = useState<string | null>(null);
  const currentRef = useRef<HTMLButtonElement>(null);
  const scrolled = useRef(false);
  const [wrap, width] = useWidth();

  // Bring the next step into view once.
  useEffect(() => {
    const el = currentRef.current;
    if (!el || scrolled.current || !width) return;
    scrolled.current = true;
    const top = el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.42;
    if (top > 0) window.scrollTo({ top });
  }, [width]);

  // Tap anywhere else to close the popover.
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!(e.target as Element).closest(".path-node, .path-pop")) setOpen(null); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const { Defs, End } = theme;
  return (
    <div className="path" data-path-theme={theme.id} style={theme.vars as CSSProperties} ref={wrap}>
      {Defs && <Defs />}
      {width > 0 && chapters.map((ch) => (
        <Chapter key={ch.id} ch={ch} book={book} width={width} theme={theme} open={open} setOpen={setOpen} currentRef={currentRef} />
      ))}
      <div className="path-end"><End book={book} /></div>
    </div>
  );
}

/** Measures the path's width. Callback ref, so it starts measuring whenever the element mounts. */
function useWidth(): [(el: HTMLDivElement | null) => void, number] {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, w];
}

function Chapter({ ch, book, width, theme, open, setOpen, currentRef }: {
  ch: ChapterView; book: BookSummary; width: number; theme: LoadedTheme;
  open: string | null; setOpen: (k: string | null) => void; currentRef: RefObject<HTMLButtonElement | null>;
}) {
  const nav = useNavigate();
  const { stops, height, road, travelled, scenery, locked } = layoutChapter(ch, book, width, theme);
  const { Road, ChapterHeader, copy } = theme;
  const StepArt = theme.step.Art, BossArt = theme.boss.Art;

  return (
    <section className={`path-chapter ${locked ? "is-locked" : ""}`} style={{ height }}>
      <svg className="path-art" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
        <Road d={road} travelled={travelled} locked={locked} />
        {scenery.length > 0 && (
          <g className="path-scenery">
            {scenery.map(({ decor, x, y }, i) => <g key={i} transform={`translate(${x - decor.w / 2} ${y - decor.h})`}>{decor.el}</g>)}
          </g>
        )}
      </svg>

      <div className="path-chapter-head" style={{ height: theme.layout.head }}>
        <ChapterHeader chapter={ch} locked={locked} width={width} />
      </div>

      {stops.map((st) => {
        const spec = st.kind === "boss" ? theme.boss : theme.step;
        const { width: w, height: h } = spec;
        const top = st.y - (spec.anchor ?? h / 2);
        const isOpen = open === st.key;
        const isCurrent = st.status === "current";
        const popW = Math.min(300, width - 16);
        const popLeft = Math.min(width - popW - 8, Math.max(8, st.x - popW / 2));
        return (
          <div key={st.key}>
            <button
              ref={isCurrent ? currentRef : undefined}
              className={`path-node is-${st.kind} is-${st.status}`}
              style={{ left: st.x - w / 2, top, width: w, height: h }}
              onClick={() => setOpen(isOpen ? null : st.key)}
              aria-label={`${st.title}${st.status === "locked" ? " (locked)" : ""}`}
            >
              {isCurrent && <span className="path-halo" style={{ width: w + 24, marginLeft: -(w + 24) / 2 }} />}
              {st.kind === "boss" ? <BossArt state={st.status} chapter={ch} /> : <StepArt state={st.status} index={st.index} chapter={ch} />}
              {isCurrent && !isOpen && <span className="path-tip">{st.kind === "boss" ? copy.bossTip : copy.stepTip}</span>}
            </button>
            {isOpen && (
              <div className={`path-pop ${st.status === "locked" ? "locked" : ""}`}
                style={{ left: popLeft, top: top + h + 12, width: popW, "--arrow": `${st.x - popLeft}px` } as CSSProperties}>
                <div>
                  <h3>{st.title}</h3>
                  <p>{st.status === "locked" ? copy.lockedHint : st.sub}</p>
                </div>
                {st.status !== "locked" && (
                  <button className="btn block" onClick={() => nav(st.href)}>
                    {st.status === "done" ? (st.kind === "boss" ? "Retake" : "Read again") : "Start"}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
