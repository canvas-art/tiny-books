# Path themes

The path engine (`src/path/Path.tsx` and `layout.ts`) handles layout and behaviour: where each step sits, how the road winds, what is done or locked, taps, popovers and scrolling.
A theme draws everything you see.
The contract is `PathTheme` in `src/path/types.ts`.

| Theme | Look | Used by |
| --- | --- | --- |
| `minimal` | Ink on paper, no scenery | The default: any book without a theme, or with an unknown one |
| `roman` | Milestones, triumphal arches, carved tablets, Roman scenery | *Meditations* |

## Add a theme

1. Copy `minimal/` to `themes/<id>/`. The folder name is the theme id.
   Any folder with an `index.tsx` is picked up automatically, with no registry to edit.
2. Draw your parts in `index.tsx`:

   | Part | What it draws |
   | --- | --- |
   | `Road` | The road surface, plus the stretch already travelled |
   | `step` / `boss` | A reading step, and the chapter quiz. Each gives its size, the `anchor` (the point that sits on the road) and an `Art` component that receives `state`: `done`, `current` or `locked` |
   | `ChapterHeader` | The heading of each chapter |
   | `End` | The marker after the last chapter |
   | `scenery` (optional) | `Decor` pieces placed beside the road |
   | `Defs` (optional) | Shared SVG gradients and patterns |

   Other options: `fonts` (the path waits for them, so text never jumps); `layout` to retune spacing or how much the road winds; `copy` for the wording; and `vars` to recolour the engine's tip, popover and halo (see `--path-*` in `src/styles.css`).
3. Scope the theme's CSS under `[data-path-theme="<id>"]`, and prefix SVG ids with `<id>-`.
   Theme CSS stays loaded after the reader switches to another book, so unscoped rules would leak into other themes.
4. Give a book the theme in a migration:

   ```sql
   UPDATE books SET path_theme = '<id>' WHERE slug = '<book>';
   ```

To preview a theme on any book, add `?theme=<id>` to the URL, for example `/?theme=minimal`.

Every theme except `minimal` is its own code-split chunk. It downloads only when a book uses it, so adding themes doesn't grow the main bundle.
If a theme fails to load, the path falls back to `minimal`.
