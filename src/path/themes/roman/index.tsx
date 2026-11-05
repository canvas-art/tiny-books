import type { PathTheme } from "../../types";
import { roman } from "../../../format";
import { Arch, ChapterHeader, Defs, End, Milestone, Road } from "./art";
import { scenery } from "./scenery";
import "./roman.css";

/** Classical antiquity: a Roman road of milestones, triumphal arches and carved tablets. */
export default {
  name: "Roman road",
  fonts: {
    href: "https://fonts.googleapis.com/css2?family=Cinzel:wght@700&display=swap",
    wait: ["700 14px Cinzel"],
  },
  copy: {
    lockedHint: "Walk the road up to here to unlock it.",
    bossTitle: (ch) => `Book ${roman(ch.position)} quiz`,
  },
  Defs,
  Road,
  ChapterHeader,
  step: { width: 64, height: 84, anchor: 52, Art: Milestone },
  boss: { width: 100, height: 96, anchor: 58, Art: Arch },
  scenery,
  End,
} satisfies PathTheme;
