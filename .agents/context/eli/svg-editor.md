# SVG Editor — planning

Status: draft (revised). Owner: Eli.

## Motivation

A demo of how this Lite fork could incorporate Rust/WASM/WebGPU graphics
tooling — specifically the Linebender stack (Vello, Kurbo, Peniko) — for
in-app vector editing. The story: an SVG file in the Assets sidebar gets
an "Edit" action; clicking it opens a full-screen bezier editor;
saving writes the modified SVG back to the same file.

This is a Lite-only experiment. It will not be upstreamed via the PR.

## Top constraint: minimum sync overlap

This fork tracks PR #11317 by periodic rebase. Every line we change in
PR-touched files is a potential conflict on every sync. So:

- **All new code lives in fresh paths** the PR doesn't touch:
  `src/lite/svgEditor/`, `crates/svg-editor-core/`, plus a setup script.
- **One unavoidable touchpoint**: the Assets context menu is hardcoded
  (no extension API), so we add a single menu item there. ~1 line.
- **No router changes.** The editor is a `<Teleport>`-based modal, not
  a route. Sidebar stays visible by default — we're not navigating away.
- **No layout-shell editing.** The modal mounts on top of whatever is
  already mounted.
- **No core component edits.** Output panels, builder backdrop, app-mode
  layout, graph canvas — all untouched.

If the menu file ever conflicts on sync, the resolution is a 1-line
re-add. Anything more invasive is rejected as a design.

## UX

1. User browses the **Assets** sidebar tab.
2. For an SVG file (`mimetype === 'image/svg+xml'` / `.svg` suffix),
   the per-item "..." menu shows an additional **Edit** item.
3. Clicking Edit opens a full-screen modal editor (the sidebar remains
   visible — the modal does not cover it).
4. The modal toolbar has **Close** (discard) and **Save** (write back).
5. Save replaces the original file in place via the same path. No new
   workflow run, no branching — just an in-place artifact edit.

Out of v1: layer panels, multi-document editing, gradient/fill editing,
text glyphs, clip paths, animations, format conversion (PNG → SVG).

## Architecture

Two-layer split, deliberately:

- **Rust → WASM core** (`crates/svg-editor-core/`): rendering, geometry,
  hit-testing, edit state, undo/redo, SVG parse/serialize. Exposes a
  small JS API via `wasm-bindgen`.
- **Vue UI** (`src/lite/svgEditor/`): the menu hook, the modal shell,
  the toolbar, save/cancel flow, keyboard shortcut wiring. Calls into
  the WASM core; doesn't know about beziers.

The canvas is a single `<canvas>` element handed to WASM for WebGPU
rendering via Vello. Vue chrome (toolbar, mode buttons, save/cancel)
is plain DOM positioned on top.

### WASM ↔ JS boundary (sketch)

```
init(canvas, svgString) -> EditorHandle
handle.set_tool(tool: "select" | "pen" | "knife" | ...)
handle.on_pointer_event(evt)
handle.undo() / handle.redo()
handle.export_svg() -> string
handle.dispose()
```

Keep the boundary small. Don't ship bezier types across — the JS side
talks tools, events, and serialized SVG.

## Touchpoints (concrete)

**Files we modify** (this is the entire surface; everything else is new):

1. `src/platform/assets/components/MediaAssetContextMenu.vue` —
   add one entry to the `contextMenuItems` array, gated on
   `asset.mimetype === 'image/svg+xml'`. Emits an event picked up by
   the lite shim.

That's it for existing files. If even this conflicts on rebase, the
resolution is a 1-line re-add.

**Files we create** (all in fresh paths the PR cannot touch):

```
crates/svg-editor-core/                  Rust crate, cdylib for wasm
  Cargo.toml
  src/
    lib.rs                               wasm-bindgen surface
    path/                                ported from runebender-xilem
    editing/                             selection, hit_test, undo, viewport
    tools/                               select, pen, knife
    render.rs                            Vello scene building
    svg_io.rs                            parse/serialize SVG (usvg + custom)

src/lite/svgEditor/
  SvgEditorModal.vue                     <Teleport to="body"> full-screen modal
  SvgEditorToolbar.vue                   tool buttons, save/cancel
  SvgEditorCanvas.vue                    the <canvas> + WASM init
  useSvgEditor.ts                        composable wrapping the WASM handle
  useSvgEditorState.ts                   modal open/close + active asset path
  pkg/                                   wasm-bindgen output (gitignored)

src/lite/registerLite.ts                 single import barrel — main.ts adds
                                         one line: import './lite/registerLite'

scripts/
  install-svg-node.sh                    copies python/svg_demo_nodes/ into
                                         ~/Comfy/repos/ComfyUI/custom_nodes/

python/svg_demo_nodes/                   Python custom node sources
  __init__.py
  simple_svg.py                          SimpleSVG / SaveSVG nodes
  README.md
```

The `registerLite.ts` indirection means future Lite features (theme,
vectorizer, etc.) all add themselves to one barrel without re-touching
`main.ts` — ever. Total `main.ts` touchpoints over the fork's lifetime
is exactly one line.

### State/event flow

```
MediaAssetContextMenu.vue
  user clicks "Edit"
  → emits @edit-svg with asset path
  → handler in MediaAssetContextMenu (added by us, 1 line) calls
    useSvgEditorState().open(assetPath)

src/lite/svgEditor/
  useSvgEditorState (Pinia store) flips isOpen=true, sets activePath
  SvgEditorModal (mounted at app root via registerLite) reacts to isOpen
  modal fetches the SVG via api.getUserData(activePath)
  hands the string to WASM init
  user edits
  Save: handle.export_svg() → api.storeUserData(activePath, svg, {stringify:false})
  Close: dispose, isOpen=false
```

The single existing-file touch on `MediaAssetContextMenu.vue` is:

```
{ label: 'Edit', command: () => $emit('edit-svg', asset),
  visible: asset.mimetype === 'image/svg+xml' }
```

## Linebender stack

- **Vello** — GPU renderer (WebGPU via wgpu). Renders SVG paths and
  editor decorations (control points, handles, selection highlights)
  in one scene.
- **Kurbo** — bezier/curve math. `BezPath`, `Point`, affine transforms,
  hit-testing arithmetic.
- **Peniko** — paint/brush abstractions Vello consumes.
- **usvg** (resvg ecosystem) — parse incoming SVG into kurbo paths. For
  serialization on the way out, either round-trip through usvg or write
  a small custom serializer (kurbo `BezPath` → SVG `d` attribute is
  trivial).
- **Xilem** — _not used_. We render through Vello directly and present
  the editor through Vue + Vello. Xilem stays in the desktop runebender.

## Parts to mine from `runebender-xilem`

Located at `/home/eli/GH/repos/runebender-xilem` (or wherever Eli has it
locally). Apache-2.0 (compatible with this repo's GPLv3 — incoming
Apache code can be relicensed under GPLv3). Likely-reusable modules:

- `src/path/` — bezier path representation
  - `cubic.rs`, `point.rs`, `point_list.rs`, `segment.rs` — core types
  - `hyper.rs`, `quadratic.rs` — _skip for v1_; SVG is cubic-native
- `src/editing/`
  - `hit_test.rs` — point/segment hit testing
  - `selection.rs` — selection set + multi-select logic
  - `mouse.rs` — pointer event dispatch
  - `undo.rs` — undo/redo stack
  - `viewport.rs` — zoom/pan transform
  - `edit_types.rs` — edit operation enums
- `src/tools/`
  - `select.rs` — direct selection tool (drag points/handles)
  - `pen.rs` — pen tool (add/insert points)
  - `knife.rs` — split a segment
  - `mod.rs` — tool dispatch interface

_Not reusable_: `shaping/`, `sort/`, `model/`, `views/`, `theme.rs`,
`file_watcher.rs`, anything UFO/font-specific.

Approach: copy modules into `crates/svg-editor-core/`, strip font/UFO
references, port from Xilem event types to a thin custom event enum
fed by `wasm-bindgen` from JS.

## Local SVG generation (companion Python node)

To test the editor end-to-end without cloud, we ship a tiny Python
custom node that emits SVG into the user's assets directory.

`python/svg_demo_nodes/simple_svg.py` exposes two nodes:

- **`SimpleSVG`** — inputs: `width`, `height`, `bg_color`, `shape_type`
  (rect/circle/triangle/star), `shape_color`. Output: SVG string.
- **`SaveSVG`** — inputs: an SVG string, a filename (no extension).
  Side effect: writes `<assets_dir>/<filename>.svg`. Output: the saved
  asset path so a downstream node could chain.

Distribution: `scripts/install-svg-node.sh` copies the folder into
`~/Comfy/repos/ComfyUI/custom_nodes/SimpleSVG/`. Mirrors how
`tools/devtools/` is installed for browser tests.

A demo workflow `image_simple_svg_demo.app.json` (lives in
`~/Comfy/repos/ComfyUI/user/default/workflows/`) chains
`SimpleSVG → SaveSVG`. Run it once → an SVG appears in Assets → click
Edit on it → demo complete.

Once the img2bez vectorizer plan lands, the workflow can be upgraded
to `prompt → diffusion → vectorize → SaveSVG` for a richer demo.

## Open questions

1. **WebGPU fallback.** Vello supports WebGL2 fallback via wgpu. Do we
   require WebGPU and gate the feature on browser support, or ship the
   fallback path? Likely require WebGPU for v1; surface a clear message
   otherwise.
2. **Wasm build pipeline.** Build on CI and commit the `.wasm` artifact,
   or build locally with a `pnpm` script that shells to `wasm-pack`?
   Affects contributor setup and review surface.
3. **SVG features supported.** v1 supports paths only? Or also basic
   shapes (rect/circle/ellipse/polygon)? Probably auto-convert basic
   shapes to paths on load.
4. **License of mined code.** Runebender is Apache-2.0; this repo is
   GPLv3. Apache-2.0 → GPLv3 is one-way compatible. Confirm we accept
   the direction (we lose the option to upstream improvements back to
   runebender as Apache).
5. **Coordinate system.** SVG is y-down, runebender's font code is y-up.
   Flip on import or normalize internally to y-down.
6. **Modal sizing.** Full-screen edge to edge, or inset with padding?
   Sidebar stays visible regardless — but the modal's exact bounds
   affect whether the side toolbar is also covered or not.

## Milestones

1. **M1 — wasm hello.** New crate, Vello renders a hardcoded SVG into
   a canvas mounted in a stub Vue page (no menu integration yet).
   Proves the build pipeline and JS↔WASM boundary.
2. **M2 — selection + drag.** Port `path/`, `editing/selection.rs`,
   `editing/hit_test.rs`. Click to select a point, drag to move it,
   re-render. Single tool ("select"). Undo/redo wired up.
3. **M3 — modal integration.** Add the Edit menu item; modal opens for
   any SVG asset; loads via `getUserData`, saves via `storeUserData`.
   Cancel discards. End-to-end without pen/knife tools.
4. **M4 — local generation.** Ship the `SimpleSVG` Python node and
   `image_simple_svg_demo.app.json` workflow; verify the round-trip
   (workflow → asset → edit → save → asset updated).
5. **M5 — pen + knife tools.** Port the rest of the tool set. Insert
   points, split segments, remove points.
6. **M6 — polish.** Keyboard shortcuts, zoom/pan, snapping,
   smooth/cusp toggling, basic shape import.

M1–M4 is the minimum viable feature for a demo. M5–M6 are independent
follow-ups.

## References

- Vello: <https://github.com/linebender/vello>
- Kurbo: <https://github.com/linebender/kurbo>
- usvg / resvg: <https://github.com/RazrFalcon/resvg>
- Runebender (source for mining): `/home/eli/GH/repos/runebender-xilem`
  (`https://github.com/eliheuer/runebender-xilem`)
- App-mode PR this fork is based on:
  <https://github.com/Comfy-Org/ComfyUI_frontend/pull/11317>
- ComfyUI custom node distribution precedent:
  `tools/devtools/` (frontend repo) → copied to
  `<ComfyUI>/custom_nodes/ComfyUI_devtools/`
