# SVG Editor — planning

Status: draft. Owner: Eli.

## Motivation

In app mode, SVG outputs from a workflow are static — viewing only. Users
who generate SVGs (logos, vector illustrations, masks) often want a quick
touch-up: nudge a control point, smooth a curve, delete a stray segment.
Round-tripping through an external editor (Figma, Inkscape, Illustrator)
breaks the in-app flow.

This feature adds an inline bezier editor that overlays the output view
on demand, so the user can edit the SVG and feed the result back to the
workflow without leaving the page.

## UX (v1)

- Output panels with SVG content show a small **edit** button in the header.
- Clicking it overlays an editor surface on top of the output view (same
  bounds as the rendered SVG).
- The overlay is a **GPU-rendered canvas** showing the SVG with editable
  control points and handles.
- Vue chrome (toolbar, mode selector, save/cancel, zoom level) floats on
  top of the canvas as regular DOM.
- Closing the editor either commits the edited SVG back to the output or
  discards changes.

Out of v1: layer panels, multi-document, gradients/fills editing, text,
clip paths, animations.

## Architecture

Two-layer split, deliberately:

- **Rust → WASM core**: rendering, geometry, hit-testing, edit state,
  undo/redo, SVG parse/serialize. Exposes a small JS API via
  `wasm-bindgen`.
- **Vue UI**: button on the output header, the overlay container, the
  toolbar/mode selector, the save/cancel flow, keyboard shortcut wiring.
  Calls into the WASM core; doesn't know about beziers.

The canvas is a single `<canvas>` element handed to WASM for WebGPU
rendering via Vello. Vue chrome is plain DOM positioned over it.

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

## Linebender stack

- **Vello** — GPU renderer. Renders SVG paths and editor decorations
  (control points, handles, selection highlights) in one scene.
- **Kurbo** — bezier/curve math. Path construction, affine transforms,
  hit-testing arithmetic.
- **Peniko** — paint/brush abstractions Vello consumes.
- **usvg** (resvg ecosystem) — parse incoming SVG into kurbo paths. For
  serialization on the way out, either round-trip through usvg or write
  a small custom serializer (kurbo `BezPath` → SVG `d` attribute is
  trivial).
- **Xilem** — *not used*. Xilem is a full Rust UI framework; the user's
  spec is "Vue stuff floating on top." We use Vello directly without an
  Xilem app. Reconsider only if we ever want this editor to run as a
  standalone desktop binary.

## Parts to mine from `runebender-xilem`

Located at `/Users/eli/GH/repos/runebender-xilem`. Apache-2.0 (compatible
with this repo's GPLv3 — incoming Apache code can be relicensed under
GPLv3 in this fork). Likely-reusable modules:

- `src/path/` — bezier path representation
  - `cubic.rs`, `point.rs`, `point_list.rs`, `segment.rs` — core types
  - `hyper.rs`, `quadratic.rs` — *skip for v1*; SVG is cubic-native and
    hypberbeziers add complexity we don't need yet
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
- *Not reusable*: `shaping/`, `sort/`, `model/`, `views/`, `theme.rs`,
  `file_watcher.rs`, anything UFO/font-specific. Runebender's UI is
  Xilem; we throw it away and present the editor through Vue + Vello
  directly.

Approach: copy modules into a new crate (see below), strip font/UFO
references, port from Xilem event types to a thin custom event enum
fed by `wasm-bindgen` from JS.

## Repo layout

New top-level crate, sibling to the existing `src/` Vue tree:

```
crates/
  svg-editor-core/          # Rust crate, cdylib for wasm
    Cargo.toml
    src/
      lib.rs                # wasm-bindgen surface
      path/                 # ported from runebender
      editing/              # ported from runebender
      tools/                # ported from runebender
      render.rs             # Vello scene building
      svg_io.rs             # parse/serialize SVG
src/
  components/svg-editor/    # Vue overlay + chrome
    SvgEditorOverlay.vue
    SvgEditorToolbar.vue
    useSvgEditor.ts         # composable wrapping the wasm handle
```

Build: `wasm-pack build` or `wasm-bindgen` invoked from a `pnpm` script,
output dropped where Vite can import it. Decide whether to vendor the
built `.wasm` or build on CI — open question below.

## Integration with app-mode output headers

App-mode output panels already render headers (per the PR we forked
from). The edit button slots into that header for any panel whose
output content-type is `image/svg+xml`.

Touch points to expect:
- Output panel header component — add the edit button (gated on
  SVG content type).
- Output view component — accept an optional overlay slot, mount the
  `SvgEditorOverlay` when active.
- Workflow result store — accept an updated SVG payload from the editor
  on save. Whether this triggers a re-run of downstream nodes or just
  replaces the artifact in place is an open question.

Need to read the current app-mode output panel/view code before
finalizing this section.

## Open questions

1. **Save semantics.** Does saving replace the artifact in place, write
   back as a new run, or branch the workflow? Ask before building.
2. **WebGPU fallback.** Vello supports WebGL2 fallback via wgpu. Do we
   require WebGPU and gate the feature on browser support, or ship the
   fallback path? Likely require WebGPU for v1, surface a clear message
   otherwise.
3. **Wasm build pipeline.** Build on CI and commit `.wasm` artifact, or
   build locally with a `pnpm` script that shells to `wasm-pack`?
   Affects contributor setup and PR review surface area.
4. **SVG features supported.** v1 supports paths only? Or also basic
   shapes (rect/circle/ellipse/polygon)? Probably auto-convert basic
   shapes to paths on load.
5. **License of mined code.** Runebender is Apache-2.0; this repo is
   GPLv3. Apache-2.0 → GPLv3 is one-way compatible. Confirm we're ok
   with that direction (we lose the option to upstream improvements
   back to runebender as Apache).
6. **Coordinate system.** SVG y-down, runebender's font code is y-up.
   Need to flip on import or normalize internally to y-down.

## Milestones

1. **M1 — wasm canvas hello.** New crate, Vello renders a static SVG
   from a hardcoded string into a canvas mounted in a stub Vue page.
   No editing. Proves the build pipeline and JS↔WASM boundary.
2. **M2 — selection + drag.** Port `path/`, `editing/selection.rs`,
   `editing/hit_test.rs`. Click to select a point, drag to move it,
   re-render. Single tool ("select"). Undo/redo wired up.
3. **M3 — overlay integration.** Edit button on app-mode output
   header for SVG outputs; overlay mounts; save commits back; cancel
   discards. End-to-end without pen/knife tools.
4. **M4 — pen + knife.** Port the rest of the tool set. Insert points,
   split segments, remove points.
5. **M5 — polish.** Keyboard shortcuts, zoom/pan, snapping, smooth/cusp
   toggling on points, basic shape import.

M1–M3 is the minimum viable feature. M4–M5 are independent follow-ups.

## References

- Vello: <https://github.com/linebender/vello>
- Kurbo: <https://github.com/linebender/kurbo>
- usvg / resvg: <https://github.com/RazrFalcon/resvg>
- Runebender (source for mining): `/Users/eli/GH/repos/runebender-xilem`
- App-mode PR this fork is based on:
  <https://github.com/Comfy-Org/ComfyUI_frontend/pull/11317>
