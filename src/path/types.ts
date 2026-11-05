// The contract between the path engine and a path theme.
//
// The engine (Path.tsx, layout.ts) owns everything that behaves: where each step sits, the road's
// curve, which steps are done / current / locked, tapping, the popover, scrolling to your next step.
// A theme owns everything that is drawn: the road surface, the step and quiz nodes, the chapter
// headings, the scenery and the end marker. Swap the theme and the same book gets a new world.
//
// Themes live in src/path/themes/<id>/index.tsx and are picked up automatically (see README there).

import type { ComponentType, ReactElement } from "react";
import type { BookSummary, ChapterView, MicroStatus } from "../../shared/types";

export type NodeState = MicroStatus; // "done" | "current" | "locked"

/** Props for the art of a reading step (one micro-chapter). */
export type StepArtProps = {
  state: NodeState;
  /** 0-based position of the step inside its chapter. */
  index: number;
  chapter: ChapterView;
};

/** Props for the art of the end-of-chapter quiz (the "mini-boss"). */
export type BossArtProps = { state: NodeState; chapter: ChapterView };

/** A tappable node on the road. The engine positions it and handles taps; `Art` only draws it. */
export type NodeSpec<P> = {
  width: number;
  height: number;
  /** Distance from the top of the art to the point that sits on the road. Defaults to height / 2. */
  anchor?: number;
  Art: ComponentType<P>;
};

/** Draws the road of one chapter, inside that chapter's SVG (coordinates are CSS pixels). */
export type RoadProps = {
  /** SVG path data through the whole chapter, top to bottom. */
  d: string;
  /** The stretch already travelled, up to and including the current step. Empty when none. */
  travelled: string;
  /** Nothing in this chapter is unlocked yet. */
  locked: boolean;
};

/** The heading at the top of every chapter. Rendered centred in a box `layout.head` pixels tall. */
export type ChapterHeaderProps = { chapter: ChapterView; locked: boolean; width: number };

/** A piece of scenery, drawn in its own w×h box. The engine stands it beside the road with its
 *  base (y = h) on the ground, centred on x = w / 2. */
export type Decor = { w: number; h: number; el: ReactElement };

/** Road geometry. Every value has a default (layout.ts); a theme overrides only what it needs. */
export type PathLayout = {
  /** Space for the chapter heading. */
  head: number;
  /** Vertical distance between steps. */
  step: number;
  /** Gap from the heading to the first step. */
  firstStep: number;
  /** Extra space above the quiz node. */
  bossGap: number;
  /** Road after the quiz, leading into the next chapter. */
  tail: number;
  /** How far the road swings sideways: min(amplitude, width × amplitudeRatio). */
  amplitude: number;
  amplitudeRatio: number;
  /** How quickly the road winds, in radians per step. */
  wave: number;
  /** Phase shift per chapter, so consecutive chapters don't wind the same way. */
  chapterTwist: number;
  /** Distance of scenery from the outermost bend of the road. */
  sceneryGap: number;
  /** One piece of scenery per this many steps. */
  sceneryEvery: number;
};

/** Words that carry the theme's voice. */
export type PathCopy = {
  /** Badge above the current step / quiz. */
  stepTip: string;
  bossTip: string;
  /** Shown when a locked node is tapped. */
  lockedHint: string;
  bossTitle: (chapter: ChapterView) => string;
};

export type PathTheme = {
  /** Human name, e.g. "Roman road". The theme's id is its folder name. */
  name: string;
  /** Web fonts the theme draws with. The path waits (briefly) for them, so text never jumps. */
  fonts?: {
    /** A stylesheet URL, e.g. from Google Fonts. */
    href: string;
    /** CSS font shorthands to wait for, e.g. ["700 14px Cinzel"]. */
    wait?: string[];
  };
  /** CSS custom properties set on the path's root. See the engine section of styles.css for the
   *  ones it reads (--path-accent, --path-halo, ...); the theme's own CSS may use more. */
  vars?: Record<`--${string}`, string>;
  layout?: Partial<PathLayout>;
  copy?: Partial<PathCopy>;
  /** Rendered once per path, e.g. an <svg><defs> with gradients. Prefix ids with the theme id. */
  Defs?: ComponentType;
  Road: ComponentType<RoadProps>;
  ChapterHeader: ComponentType<ChapterHeaderProps>;
  step: NodeSpec<StepArtProps>;
  boss: NodeSpec<BossArtProps>;
  /** Scenery for a chapter. The engine places them beside the road, in order, cycling. */
  scenery?: (chapter: ChapterView, book: BookSummary) => Decor[];
  /** The marker after the last chapter. */
  End: ComponentType<{ book: BookSummary }>;
};

/** A theme as the engine uses it: with its id and every default filled in. */
export type LoadedTheme = Omit<PathTheme, "layout" | "copy"> & { id: string; layout: PathLayout; copy: PathCopy };
