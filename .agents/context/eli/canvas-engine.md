# Lite Canvas Engine — planning

Status: draft. Owner: Eli.

## Motivation

A Rust + Vello + WebGPU canvas engine inside the Lite frontend. The
engine hosts multiple **tools** (sketch first; raster compositor and
vector editor later) that all share the same WASM blob, the same
renderer, the same undo/history infrastructure, the same Vue host
component.

The differentiator versus the existing ComfyUI ecosystem is the
**stack**, not the feature. There are already sketch nodes (Olm-Sketch,
ComfySketch), layered editors (LayerForge, Comfy Canvas), and basic
painters (PainterNode). All are pure JS. None use Rust/WASM/WebGPU.

The strategic bet: building a Vello-backed canvas engine pays back
across many features (sketch, compositor, vector edit, future image
filters) instead of paying for a one-shot tool.

## Top constraint: minimum sync overlap

This fork tracks PR #11317 by periodic rebase. All canvas-engine code
lives in **fresh paths** the upstream PR never touches:

- `crates/lite-canvas/` — Rust crate (cdylib, wasm target)
- `src/lite/canvas/` — Vue host components, composables
- `scripts/build-canvas-wasm.sh` — wasm-pack build script
- `examples/sketch-samples/` — sample sketch starting templates

Existing-file touchpoints across all phases (cumulative):

- `src/lite/registerLite.ts` — new feature registers itself here
  (Lite-only file, never conflicts)
- One toolbar button in a graph-mode toolbar component (Phase 2)
- One app-mode cell registration (Phase 3 — PR territory; deferred)

Phases 1 and 4-5 have **zero existing-file touchpoints**.

## What already exists in this codebase (and what we steal)

**MaskEditor** at `src/components/maskeditor/` is the closest analog.
It's a WebGPU brush canvas using `typegpu` (no WASM). Reuse patterns,
not code:

| MaskEditor pattern                                  | Reuse in canvas engine                                    |
| --------------------------------------------------- | --------------------------------------------------------- |
| `useBrushDrawing` (CPU/GPU stroke pipeline)         | mirror for sketch tool, simpler (no mask-layer branching) |
| `useGPUResources` (texture/buffer/shader lifecycle) | replaced by Vello, but conceptual structure carries over  |
| `useCanvasHistory` (undo/redo with snapshots)       | reuse approach; consider delta-based for performance      |
| `usePanAndZoom` (mouse/touch/wheel)                 | reuse directly — pan/zoom is identical concern            |
| `useCoordinateTransform` (screen ↔ canvas)          | reuse directly                                            |
| `useKeyboard` (shortcuts)                           | reuse pattern; sketch-specific bindings                   |
| Pinia store for global state                        | mirror for sketch state                                   |
| Dialog-based fullscreen modal trigger               | mirror for sketch UX                                      |
| Playwright `MaskEditorHelper.ts` test helper        | mirror for sketch e2e                                     |

**Anti-patterns to avoid (per MaskEditor pain points):**

- History snapshots full ImageData per stroke → use delta/patch-based
  history for sketch (each stroke is a small append to a list, not a
  full canvas copy).
- Multiple stacked canvases (img/mask/rgb/gpu) → sketch needs one
  canvas (Vello renders directly).
- Touch ignored in pointer events (`if (touch) return`) → sketch
  canvas should accept touch + stylus first-class.

## Architecture

### Two-layer split

- **Rust → WASM core** (`crates/lite-canvas/`): renderer (Vello),
  document model (layers, transforms, scene graph), tool
  implementations (sketch first), undo history, SVG/PNG I/O. Exposes
  a small JS API via `wasm-bindgen`.
- **Vue host** (`src/lite/canvas/`): `LiteCanvas.vue` reusable
  component that wraps the WASM and forwards pointer/keyboard events.
  The dialog wrapper, toolbar, save/cancel UI, app-mode embedding
  layers — all on top of `LiteCanvas`.

### Crate structure

```
crates/lite-canvas/
  Cargo.toml
  src/
    lib.rs                # wasm-bindgen surface
    renderer.rs           # Vello scene + render loop
    document.rs           # layers, transforms, scene graph
    history.rs            # undo/redo with delta-based events
    tools/
      sketch.rs           # brush + eraser + stroke smoothing (Phase 1)
      composite.rs        # blend modes + filters (Phase 4)
      vector.rs           # bezier paths (Phase 5; merges with svg-editor plan)
    io/
      png.rs              # raster export
      svg.rs              # vector export (Phase 5)
```

### WASM ↔ JS boundary (sketch)

```
init(canvas: HTMLCanvasElement, opts: InitOptions) -> CanvasHandle
handle.set_tool(tool: "sketch" | "composite" | "vector")
handle.set_brush(size: f32, opacity: f32, color: [u8; 4])
handle.on_pointer_event(evt: PointerEvent)
handle.undo()
handle.redo()
handle.clear()
handle.export_png() -> Uint8Array
handle.export_svg() -> string  // Phase 5
handle.dispose()
```

Keep small. Don't ship Rust types across — JS speaks events, tool IDs,
serialized buffers.

### Tool foundation

All tools share:

- A `Document` (the canvas state — layers, transforms, viewport)
- A `Renderer` (Vello scene that re-renders on doc change)
- A `History` (delta-based events that can be replayed/inverted)
- `Tool` trait that handles pointer events and produces history events

Adding a new tool = implementing the `Tool` trait, registering it,
~150-300 LOC.

## Bundle size targets

| Composition                   | Raw WASM | Gzipped |
| ----------------------------- | -------- | ------- |
| Phase 1 (foundation + sketch) | ~1.8 MB  | ~700 KB |
| Phase 4 (+ composite tool)    | ~1.95 MB | ~770 KB |
| Phase 5 (+ vector tool)       | ~2.05 MB | ~810 KB |

Renderer dominates; tools are incremental.

Trim with `default-features = false` on Vello/wgpu, `wasm-opt -Oz`,
HTTP gzip/brotli (already standard).

## UX

### Phase 1: standalone sketch dialog

User clicks **🎨 Sketch** button in graph-mode top toolbar (or app-mode
toolbar) → fullscreen modal opens with the canvas, tool palette,
save/cancel.

Toolbar contents (Phase 1):

- Brush size / opacity sliders
- Brush color picker
- Eraser toggle
- Undo / Redo
- Clear all
- Save (writes PNG to `<comfy>/user/default/sketches/`)
- Cancel (discard, close)

The saved PNG appears in the Assets sidebar via the existing
`/userdata` file-watch path (no backend code needed).

### Phase 2: node widget (graph view)

A new V2 node widget type `sketch_input` that mounts `LiteCanvas`
inline. Used by a companion Python custom node `LiteSketchInput`.
User sketches → click Run → diffusion uses sketch as ControlNet/img2img
input.

### Phase 3: app-mode input cell

Workflow author exposes a sketch input parameter; app-mode renders it
as a `LiteCanvasCell` in the right-side input panel. Scoped to fit the
cell bounds (small canvas), expandable to fullscreen on click.

### Phase 4: composite tool

Same dialog, switch tool → multi-layer image compositor (load images
as layers, blend modes, opacity, simple filters).

### Phase 5: vector tool

Same dialog, switch tool → bezier editor for SVG paths. Subsumes the
separate `svg-editor.md` plan.

## Toolchain

User runs once:

```bash
rustup target add wasm32-unknown-unknown
cargo install wasm-pack
```

Build via `./scripts/build-canvas-wasm.sh`. Output goes to
`crates/lite-canvas/pkg/` (gitignored). Vite imports the JS wrapper
that wasm-pack generates.

## Open questions

1. **WebGPU detection / fallback.** Vello supports WebGL2 fallback via
   wgpu, but adds size and complexity. v1 stance: require WebGPU,
   show a clear "WebGPU required" message otherwise. Most modern
   browsers (Chromium 113+, Safari 16.4+, Firefox 121+) support it.
2. **Wasm build pipeline.** Build on contributor machines, or commit
   the `.wasm` artifact and only rebuild in CI? Trade-off: contributor
   setup vs PR review noise.
3. **History format.** Snapshot per stroke (simple, slow at scale) vs
   delta-events with replay (complex, fast). Lean toward delta-events.
4. **Color management.** Vello supports wide-gamut natively; do we
   expose this in v1 sketch tool, or punt to Phase 4? Punt.
5. **Mobile / touch.** First-class touch + stylus from day one
   (MaskEditor's "ignore touch" was a mistake we don't repeat).
6. **Save target.** `<comfy>/user/default/sketches/` for v1 — surfaces
   in Assets sidebar via existing flow. Could add metadata sidecar
   later (`.sketch.json` with the stroke history for re-edits).
7. **Light/dark theme integration.** Canvas chrome should adopt
   active theme tokens (border, surface, text), but the canvas itself
   stays neutral (probably white/transparent — tool-relative, not
   theme-relative).

## Plan (with checkboxes)

### Phase 0 — Toolchain & scaffolding

- [ ] User installs `wasm32-unknown-unknown` rustup target
- [ ] User installs `wasm-pack` via cargo
- [ ] Create `crates/lite-canvas/` with minimal `Cargo.toml`
      (cdylib, wasm-bindgen dependency only)
- [ ] Create `crates/lite-canvas/src/lib.rs` with single
      `wasm-bindgen` exported function `add(a: u32, b: u32) -> u32`
- [ ] Create `scripts/build-canvas-wasm.sh` invoking `wasm-pack`
- [ ] Add `crates/lite-canvas/pkg/` to `.gitignore`
- [ ] Build WASM successfully → verify `pkg/` contains `.wasm` + JS wrapper
- [ ] Vite imports the JS wrapper successfully (basic test page)
- [ ] Commit Phase 0 — proves the pipeline before any real work

### Phase 1 — Foundation + sketch tool, standalone surface

**Renderer + document foundation:**

- [ ] Add Vello + wgpu + kurbo + peniko to crate deps
- [ ] Implement `renderer.rs`: Vello scene + WebGPU init + render loop
- [ ] Implement `document.rs`: simple Document struct (size, layers
      list, viewport transform)
- [ ] Render a single hardcoded shape (rectangle) via Vello → see it
      on canvas
- [ ] Verify WebGPU init works on dev's Chromium
- [ ] Commit foundation

**Sketch tool:**

- [ ] Implement `tools/sketch.rs`: brush stroke representation,
      point smoothing, line rendering as kurbo `BezPath`
- [ ] Implement `history.rs`: delta-event undo/redo
- [ ] Wire pointer events from JS → WASM tool dispatcher
- [ ] Drag mouse → see line drawn in real time
- [ ] Brush size + opacity slider integration
- [ ] Eraser tool (alpha subtraction stroke)
- [ ] Undo / redo
- [ ] Commit sketch tool

**Vue host:**

- [ ] Create `src/lite/canvas/LiteCanvas.vue` component (canvas
      element + WASM init + event forwarding)
- [ ] Create `src/lite/canvas/useLiteCanvas.ts` composable
- [ ] Create `src/lite/canvas/SketchDialog.vue` (modal wrapping
      `LiteCanvas`, with toolbar)
- [ ] Toolbar UI: brush size/opacity sliders, color picker, eraser
      toggle, undo/redo, clear, save, cancel
- [ ] Color picker: keep simple — HTML `<input type="color">` v1
- [ ] Commit Vue host

**Save/integration:**

- [ ] `handle.export_png()` returns PNG bytes
- [ ] Save flow: bytes → `api.storeUserData('sketches/<name>.png')`
- [ ] Verify saved sketches appear in Assets sidebar
- [ ] Commit save flow

**Dialog trigger:**

- [ ] Add "Sketch" entry to `registerLite.ts` global registration
- [ ] Add toolbar button to graph-mode toolbar (one new file in
      `src/lite/canvas/`, registered via Vue's globalProperties or a
      lightweight Pinia store)
- [ ] Click button → dialog opens → user can sketch → save → close
- [ ] End-to-end smoke test
- [ ] Commit Phase 1 final

**Polish:**

- [ ] Pan/zoom (mirror MaskEditor's `usePanAndZoom`)
- [ ] Keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z, B for brush, E for eraser, etc.)
- [ ] Brush smoothing tuning (Catmull-Rom or similar)
- [ ] WebGPU-not-available error message
- [ ] Playwright e2e test (mirror `MaskEditorHelper.ts` pattern)
- [ ] Commit polish

### Phase 2 — Node widget (graph view)

- [ ] Research V2 widget extension API (how custom widget types
      register)
- [ ] Build `LiteCanvasNodeWidget.vue` wrapping `LiteCanvas` for
      embedded use (smaller, no fullscreen modal)
- [ ] Companion Python custom node `LiteSketchInput` at
      `python/lite_sketch_input/__init__.py`
- [ ] `scripts/install-lite-sketch-node.sh` (mirrors
      `install-lite-themes.sh`)
- [ ] Sample workflow `sketch_to_image.app.json` demonstrating use
- [ ] e2e test: drop node, sketch in widget, run workflow
- [ ] Commit Phase 2

### Phase 3 — App-mode input cell

- [ ] Research app-mode cell registration system (PR territory —
      may need bridge pattern to avoid PR conflicts)
- [ ] Build `LiteCanvasCell.vue` for app-mode panel
- [ ] Workflow author exposes sketch input → app-mode renders cell
- [ ] e2e test in app mode
- [ ] Commit Phase 3 (with care for PR sync)

### Phase 4 — Composite tool

- [ ] Implement `tools/composite.rs`: layer model with blend modes
- [ ] Layer panel UI in dialog (add image layer, opacity, blend
      mode dropdown, visibility toggle)
- [ ] Filter primitives: gaussian blur, brightness, contrast, hue
- [ ] Sample images bundled in `examples/composite-samples/`
- [ ] Commit Phase 4

### Phase 5 — Vector tool

- [ ] Implement `tools/vector.rs`: bezier path representation,
      control point editing
- [ ] Port `runebender-xilem` pieces (path types, hit-testing,
      selection, edit operations) — see `svg-editor.md`
- [ ] SVG import (`io/svg.rs` parse → kurbo `BezPath`)
- [ ] SVG export
- [ ] Pen, knife, select tools
- [ ] Subsume `svg-editor.md` plan (this becomes the "tool" surface;
      the Assets-menu integration described in `svg-editor.md` is the
      trigger)
- [ ] Commit Phase 5

## What this design deliberately does not include

- **Animation timeline** — sketch and compositor are static-frame
  tools. Animation is a different scope.
- **3D primitives** — Vello is 2D. If we ever want 3D, that's a
  different stack.
- **Plugin/scripting system for tools** — tools are first-class Rust
  modules in our crate. No runtime plugin API.
- **Color management UI for v1** — wide-gamut/HDR is supported by
  Vello but not exposed in user UI until Phase 4+.
- **Cloud sync of sketches** — sketches save to local user data dir.
  Cloud is upstream territory.
- **Replacing MaskEditor** — MaskEditor stays as it is. Our canvas
  engine is a separate tool with overlapping but distinct purpose.

## Risks

- **WASM bundle size at limit.** ~2 MB might trip download budgets
  for some users. Mitigations: gzip (default), Brotli (CDN), code-
  split (load only when dialog opens).
- **WebGPU unavailable.** Modern browsers ship it but corporate / older
  browsers won't. v1 just shows a clear error; v2 could ship WebGL2
  fallback via wgpu (size cost).
- **Vello API churn.** Vello is pre-1.0; APIs may shift. Pin
  versions, accept periodic catch-up cost.
- **Build pipeline complexity.** Contributors need Rust + wasm-pack.
  Mitigation: ship the `.wasm` in CI artifacts, only require local
  build for crate development.
- **Performance surprises.** WebGPU shaders behave differently across
  GPUs (Apple Silicon vs Intel vs AMD). Test on multiple machines
  before declaring done.
- **App-mode integration (Phase 3) overlaps with PR territory.**
  Defer until foundation is solid; cross that bridge when we get
  there with the layered-architecture defenses already established
  (see `theme-system-design.md`).

## Ecosystem comparisons

What exists in the ComfyUI ecosystem (for context — none use
Rust/WASM/Vello):

- [ComfyUI-Olm-Sketch](https://github.com/o-l-l-i/ComfyUI-Olm-Sketch) —
  sketch node, stylus support, ControlNet-focused (pure JS)
- [LayerForge](https://github.com/Azornes/Comfyui-LayerForge) —
  Photoshop-like layered canvas with masking, blend modes (pure JS)
- [Comfy Canvas](https://github.com/Zlata-Salyukova/Comfy-Canvas) —
  inline layered image editor (pure JS)
- [Canvas Tab](https://github.com/Lerc/canvas_tab) — multi-canvas
  editor (pure JS)
- [ComfyI2I](https://github.com/ManglerFTW/ComfyI2I) — image-to-image
  painting (pure JS)
- [PainterNode (AlekPet)](https://www.runcomfy.com/comfyui-nodes/ComfyUI_Custom_Nodes_AlekPet/PainterNode)
  — basic painter (pure JS)

What exists in the broader web ecosystem (great learning resources):

- [Graphite Editor](https://github.com/GraphiteEditor/Graphite) —
  Rust + Vello + WebGPU vector design tool, _closest precedent_
- [Modyfi](https://digest.browsertech.com/archive/browsertech-digest-how-modyfi-is-building-with/)
  — WASM + WebGPU professional video editing
- [Servo](https://servo.org/) — uses Vello for HTML rendering

## References

- Vello: <https://github.com/linebender/vello>
- Kurbo: <https://github.com/linebender/kurbo>
- Peniko: <https://github.com/linebender/peniko>
- wgpu: <https://github.com/gfx-rs/wgpu>
- wasm-bindgen: <https://github.com/rustwasm/wasm-bindgen>
- wasm-pack: <https://github.com/rustwasm/wasm-pack>
- typegpu (used by MaskEditor): <https://typegpu.com/>
- MaskEditor in this repo: `src/components/maskeditor/`
- Related plan (subsumed in Phase 5): `.agents/context/eli/svg-editor.md`
- Theme architecture (sync-overlap defense pattern):
  `.agents/context/eli/theme-system-design.md`
