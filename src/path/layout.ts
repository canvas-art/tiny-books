// Pure geometry: where every node, road segment and piece of scenery of a chapter goes.

import type { BookSummary, ChapterView, MicroStatus } from "../../shared/types";
import type { Decor, LoadedTheme, PathCopy, PathLayout } from "./types";

export const DEFAULT_LAYOUT: PathLayout = {
  head: 128,
  step: 112,
  firstStep: 40,
  bossGap: 16,
  tail: 64,
  amplitude: 80,
  amplitudeRatio: 0.21,
  wave: 1.05,
  chapterTwist: 1.3,
  sceneryGap: 70,
  sceneryEvery: 2,
};

export const DEFAULT_COPY: PathCopy = {
  stepTip: "Start",
  bossTip: "Quiz",
  lockedHint: "Finish the steps before this one to unlock it.",
  bossTitle: (ch) => `Chapter ${ch.position} quiz`,
};

export type Stop = {
  key: string;
  kind: "step" | "boss";
  status: MicroStatus;
  /** 0-based index inside the chapter (the quiz comes after the last step). */
  index: number;
  title: string;
  sub: string;
  href: string;
  /** The point on the road the node stands on. */
  x: number;
  y: number;
};

export type ChapterLayout = {
  stops: Stop[];
  height: number;
  road: string;
  travelled: string;
  scenery: { decor: Decor; x: number; y: number }[];
  locked: boolean;
};

export function layoutChapter(ch: ChapterView, book: BookSummary, width: number, theme: LoadedTheme): ChapterLayout {
  const L = theme.layout;
  const cx = width / 2;
  const amp = Math.min(L.amplitude, width * L.amplitudeRatio);
  const phase = ch.position * L.chapterTwist;
  const top = L.head + L.firstStep;

  const stops: Stop[] = ch.micros.map((m, i) => ({
    key: `m${m.id}`, kind: "step", index: i, status: book.enrolled ? m.status : "locked",
    title: m.title, sub: `${m.minutes} min read`, href: `/read/${m.id}`,
    x: cx + amp * Math.sin(phase + i * L.wave), y: top + i * L.step,
  }));
  stops.push({
    key: `q${ch.id}`, kind: "boss", index: ch.micros.length, status: book.enrolled ? ch.quiz.status : "locked",
    title: theme.copy.bossTitle(ch),
    sub: ch.quiz.score != null ? `Best score ${ch.quiz.score}/${ch.quiz.total}` : `${ch.quiz.total} questions`,
    href: `/quiz/${ch.id}`, x: cx, y: top + ch.micros.length * L.step + L.bossGap,
  });
  const height = stops[stops.length - 1].y + theme.boss.height / 2 + L.tail;
  const locked = stops.every((s) => s.status === "locked");

  // The road enters at the top centre, winds through every stop and leaves at the bottom centre.
  const pts: [number, number][] = [[cx, 0], [cx, L.head - 30], ...stops.map((s) => [s.x, s.y] as [number, number]), [cx, height]];
  const reached = stops.findIndex((s) => s.status !== "done");
  const travelledPts = locked ? 0 : reached === -1 ? pts.length : reached + 3; // up to and including the current stop

  // Scenery stands beside the road, on the side away from the bend, between two stops.
  const pieces = theme.scenery?.(ch, book) ?? [];
  const scenery: ChapterLayout["scenery"] = [];
  if (pieces.length) {
    for (let i = 0; i < stops.length - 1; i += L.sceneryEvery) {
      const s = stops[i];
      const decor = pieces[scenery.length % pieces.length];
      const side = s.x > cx ? -1 : 1;
      const x = Math.min(width - decor.w / 2 - 4, Math.max(decor.w / 2 + 4, cx + side * (amp + L.sceneryGap)));
      scenery.push({ decor, x, y: (s.y + stops[i + 1].y) / 2 + 30 });
    }
  }

  // The travelled stretch is a prefix of the same curve, so it lies exactly on the road.
  const segs = curve(pts);
  const travelled = travelledPts < 2 ? "" : segs.slice(0, travelledPts).join("");
  return { stops, height, road: segs.join(""), travelled, scenery, locked };
}

/** Smooth curve through points (Catmull-Rom converted to cubic Béziers): the move to the first point,
 *  then one segment per following point. Join them for SVG path data. */
export function curve(pts: [number, number][]): string[] {
  if (pts.length < 2) return [];
  const d = [`M${pts[0][0]} ${pts[0][1]}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d.push(` C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${p2[0]} ${p2[1]}`);
  }
  return d;
}
