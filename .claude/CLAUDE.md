# KiCad Project Table Generator

A browser and desktop app that makes a title-block style table for a PCB: a logo next to rows of text, sized in millimetres, copied into KiCad as a footprint or exported as PNG or SVG. It was rewritten on 2026-10-11 from a Python/CustomTkinter script (still in git history) into the same shape as Szymon's other app, Kreskit (`~/Projects/Personal/36-Kreskit`), which is the reference for stack, look and conventions.

The owner is Szymon (GitHub `Szymon423`). The repository is `Szymon423/KiCad-Project-Table-Generator`, and the app is published at https://szymon423.github.io/KiCad-Project-Table-Generator/.

## Stack

- Vanilla TypeScript + Vite. No UI framework, no canvas library.
- `opentype.js` parses fonts and gives letter outlines. It is the only runtime dependency.
- GitHub Pages serves the web build, deployed by `.github/workflows/pages.yml` on every push to `main`.
- **Desktop shell**: Tauri 2 (Rust) in `src-tauri/`, copied from Kreskit, including the NVIDIA/Wayland DMABUF workaround in `main.rs` (do not remove it). Anything desktop-only sits behind `isTauri` in `src/files.ts` and has a browser fallback; after a change to saving, opening or the clipboard, think about both targets.

## Commands

```sh
npm install        # once per machine
npm run dev        # the app at http://localhost:1420
npm run build      # tsc type-check + production build
npm run build:web  # the Pages build, relative base, into dist-web/
npm run tauri dev  # the desktop app with hot reload
npm run tauri build   # installers, into src-tauri/target/release/bundle/
(cd src-tauri && cargo check)   # check the Rust shell
```

There are no automated tests and no linter. `npm run build` and `cargo check` are the only automatic checks, so run them after a change. Vite's dev server does not type-check.

## Architecture rules

- **The document is the source of truth** (`Doc` in `src/model.ts`), with every length in millimetres.
- **One layout function decides all geometry** (`layoutTable` in `src/layout.ts`). It rounds each length to whole pixels once and builds every position from those, which is what keeps lines, logo and text free of seams. Do not position anything in a renderer.
- **Renderers only read the layout.** The canvas renderer (`src/render.ts`) and the SVG writer (`src/export.ts`) must stay in step; a change to how the table looks goes into the layout, or into both.
- **Text is outlined from the font file**, not drawn by the browser, so PNG and SVG match exactly. Layout is per glyph with kerning in `src/fonts.ts`; the shaping code in opentype.js throws on some fonts (DejaVu among them), so do not switch to `font.getPath`.
- **The KiCad footprint is traced from the rendered canvas** (`src/footprint.ts`), not built from the vector geometry: the table is rendered at 2400 DPI, its dark pixels are outlined along pixel edges, the outlines are simplified, and holes are joined to their outline by zero-width cuts, because KiCad's `fp_poly` has no holes. Tracing the picture is what makes the logo and the inverted look work with no special cases. The footprint is always on `F.SilkS`; KiCad's own flip moves and mirrors it for the back.
- **The image has no outer margin.** Its edges are the table's outer lines, because the size typed into KiCad on import must be the size of the table. Szymon asked for this explicitly.
- **Project files (`.ktable`) must stay readable.** They are JSON with `app`, `version` and the document. If the format changes, bump `version` and keep loading the old one. Anything read from a file or from storage goes through `restore` in `src/main.ts`.
- **The web build uses a relative base.** Use `import.meta.env.BASE_URL` for the app's own files, never absolute URLs.

## Decisions Szymon made

- Output formats are the KiCad footprint (clipboard and `.kicad_mod`), PNG, SVG and the editable project. PDF was built and removed at his request.
- KiCad has no command-line image converter (`kicad-cli` cannot do it), which is why the app writes the footprint itself. Pasting `(footprint ...)` text into the PCB editor is how it gets there.
- The Output section can fix the table's overall height (`sizeBy: 'height'`). All lengths are then scaled by one factor inside `layoutTable`, and the pixel density is nudged so the height is exact. He asked for height because the width depends on the text.
- One output menu in the toolbar, as in Kreskit, instead of separate buttons.
- `Ctrl+S` saves the project and `Ctrl+E` exports the PNG.

## Checking a change

You cannot click in the app. What does work is headless Firefox against `npm run dev`:

```sh
firefox --headless --no-remote --profile <empty dir> --window-size 1280,800 --screenshot out.png <url>
```

The screenshot is taken at the load event, before fonts and the logo have loaded. Delay the load event by having the page include an image from a local server that answers after a few seconds. For exports, a throwaway test page can import the `src/` modules, build files and POST them to a local server, where `rsvg-convert` and Pillow can compare SVG against PNG. A generated footprint can be checked with `kicad-cli fp export svg <dir>.pretty -o <out> --layers F.SilkS`, which renders it as KiCad reads it; KiCad rounds that SVG's size to whole mils, so expect a one-pixel scale difference against the PNG. Keep such pages out of the repository.

When a change affects interaction, say plainly that it is untested in the window and list what Szymon should try.

## Boundaries

- Ask before adding a dependency, npm or cargo.
- Ask before widening Tauri permissions in `src-tauri/capabilities/default.json` or changing the app identifier (`io.github.szymon423.kicad-table-generator`).
- Do not start `npm run tauri dev` expecting to interact with it; Szymon runs the app and reports back.
- The icon source is `src-tauri/app-icon.svg` (a copy of `public/icon.svg`). After changing it, run `npx tauri icon src-tauri/app-icon.svg` and delete `src-tauri/icons/android` and `ios`.
- Do not introduce a UI framework.
- Commit and push only when asked. Never force-push.
- `assets/images/logo_m4t.png` and `table-*.png` in the root are Szymon's private files with a company logo. They are git-ignored; never commit, move or delete them.
- `example/app.png` is shown in the README. When the look of the app changes, retake it.
- Keep `README.md` in step with features and shortcuts.

## Code style

No semicolons, single quotes, 2-space indent, small modules with named exports. Comments explain why, not what. UI text and code are in English.

## Working with Szymon

- He often dictates by voice, in English or Polish, so messages can contain transcription errors ("CrashKit" and "CrestKit" meant Kreskit, "SVJ" meant SVG). Read for intent, and ask when a garbled word changes what should be done.
- Reply in the language he wrote in.
- He tests in the real app and gives feedback in short rounds. Work in small stages he can try, and end each one with what to check.
