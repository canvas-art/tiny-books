// Finds, loads and caches path themes.
//
// Every folder in ./themes with an index.tsx is a theme; its folder name is its id. Themes are
// code-split and only downloaded when a book uses them. The default theme ships in the main bundle,
// so a book without a theme (or with an unknown one) renders straight away, and it is also the
// fallback if a theme fails to load.

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import type { LoadedTheme, PathTheme } from "./types";
import { DEFAULT_COPY, DEFAULT_LAYOUT } from "./layout";
import minimal from "./themes/minimal";

export const DEFAULT_THEME = "minimal";

const loaders = new Map(
  Object.entries(import.meta.glob<{ default: PathTheme }>(["./themes/*/index.tsx", "!./themes/minimal/index.tsx"]))
    .map(([file, load]) => [file.split("/")[2], load] as const),
);

/** Ids of every available theme. */
export const themeIds = [DEFAULT_THEME, ...loaders.keys()];

const prepare = (id: string, t: PathTheme): LoadedTheme => ({
  ...t, id,
  layout: { ...DEFAULT_LAYOUT, ...t.layout },
  copy: { ...DEFAULT_COPY, ...t.copy },
});

const ready = new Map<string, LoadedTheme>([[DEFAULT_THEME, prepare(DEFAULT_THEME, minimal)]]);
const pending = new Map<string, Promise<LoadedTheme>>();

export const resolveThemeId = (id: string | null | undefined) => (id && loaders.has(id) ? id : DEFAULT_THEME);

/** Load a theme (and its fonts). Safe to call early, e.g. as soon as we know which book is next. */
export function loadPathTheme(requested: string | null | undefined): Promise<LoadedTheme> {
  const id = resolveThemeId(requested);
  const done = ready.get(id);
  if (done) return Promise.resolve(done);
  let p = pending.get(id);
  if (!p) {
    p = loaders.get(id)!()
      .then(async (m) => {
        const theme = prepare(id, m.default);
        if (theme.fonts) await loadFonts(theme.fonts);
        return theme;
      })
      .catch((err) => {
        console.error(`Path theme "${id}" failed to load, using "${DEFAULT_THEME}"`, err);
        return ready.get(DEFAULT_THEME)!;
      })
      .then((theme) => { ready.set(id, theme); pending.delete(id); return theme; });
    pending.set(id, p);
  }
  return p;
}

/**
 * The theme for a book. `undefined` means the book hasn't loaded yet (returns null); `null` means
 * the book has no theme (the default). Add `?theme=<id>` to the URL to preview any theme.
 */
export function usePathTheme(bookTheme: string | null | undefined): LoadedTheme | null {
  const [params] = useSearchParams();
  const id = bookTheme === undefined ? null : resolveThemeId(params.get("theme") ?? bookTheme);
  const [, loaded] = useState(0);
  useEffect(() => {
    if (!id || ready.has(id)) return;
    let live = true;
    void loadPathTheme(id).then(() => { if (live) loaded((n) => n + 1); });
    return () => { live = false; };
  }, [id]);
  return id ? ready.get(id) ?? null : null;
}

const sheets = new Map<string, Promise<void>>();

/** Add the theme's stylesheet once, then wait for its faces, but never longer than a moment. */
function loadFonts({ href, wait = [] }: NonNullable<PathTheme["fonts"]>) {
  let sheet = sheets.get(href);
  if (!sheet) {
    sheet = new Promise<void>((resolve) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.onload = link.onerror = () => resolve();
      document.head.appendChild(link);
    });
    sheets.set(href, sheet);
  }
  const faces = sheet.then(() => Promise.all(wait.map((f) => document.fonts.load(f)))).then(() => undefined, () => undefined);
  return Promise.race([faces, new Promise<void>((r) => setTimeout(r, 1500))]);
}
