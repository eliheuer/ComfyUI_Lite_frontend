# Lite Canvas Engine — planning

Status: draft. Owner: Eli.

## Motivation

A Rust + Vello + WebGPU canvas engine inside the Lite frontend.
**This is a platform play, not a tool.** The engine hosts multiple
**tools** that all share the same WASM blob, the same renderer, the
same undo/history infrastructure, the same Vue host component.

By the end of Phase 3 of the rollout below, the standalone canvas
dialog hosts **three tools** — sketch, vector edit, raster compositor —
sharing one engine. **No existing ComfyUI extension does this.**
Existing sketch/canvas tools (Olm-Sketch, LayerForge, Comfy Canvas,
ComfyI2I, PainterNode) are each pure-JS and ship one feature each.
The differentiator is _the integrated platform_, not any single tool.

A bare-minimum sketch tool by itself isn't meaningfully better than
Olm-Sketch. The engine's payoff appears when sketch + vector +
compositor + (future image filters) all share the same paid-for
foundation.

The phase ordering below is **engine + tools first, deeper integrations
later** — so the platform identity is visible by Phase 3 even before
the engine reaches into graph view and app mode.

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
- One toolbar button in a graph-mode toolbar component (Phase 4)
- One app-mode cell registration (Phase 5 — PR territory; deferred to last)

Phases 1–3 have **zero existing-file touchpoints**.

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
      vector.rs           # bezier paths (Phase 2; merges with svg-editor plan)
      composite.rs        # blend modes + filters (Phase 3)
    io/
      png.rs              # raster export
      svg.rs              # vector export (Phase 2)
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
handle.export_svg() -> string  // Phase 2
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
| Phase 2 (+ vector tool)       | ~1.9 MB  | ~750 KB |
| Phase 3 (+ composite tool)    | ~2.05 MB | ~810 KB |

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

### Phase 2: vector tool

Same dialog, switch tool → bezier editor for SVG paths. Subsumes the
separate `svg-editor.md` plan. The differentiated feature — no other
ComfyUI extension edits bezier paths.

### Phase 3: composite tool

Same dialog, switch tool → multi-layer image compositor (load images
as layers, blend modes, opacity, simple filters).

By the end of Phase 3 the dialog hosts three tools on one engine —
the platform identity is now visible.

### Phase 4: node widget (graph view)

A new V2 node widget type `sketch_input` (or `canvas_input`) that
mounts `LiteCanvas` inline. Used by a companion Python custom node
`LiteSketchInput`. User sketches → click Run → diffusion uses the
canvas content as ControlNet/img2img input.

### Phase 5: app-mode input cell

Workflow author exposes a canvas input parameter; app-mode renders it
as a `LiteCanvasCell` in the right-side input panel. Scoped to fit the
cell bounds (small canvas), expandable to fullscreen on click.

### Visible platform identity

Even at Phase 1, small touches make the platform feel like a platform:

- **Subtle "Powered by Rust + WebGPU" footer** in the dialog. Tasteful,
  not a banner — credit the stack so users notice it's different.
- **Real-time perf indicators** during drawing: FPS, stroke count,
  paths/sec. Off by default, on via a settings toggle.
- **Crisp anti-aliased strokes at any zoom.** Vello stays sharp where
  Canvas 2D goes blurry. Make zooming a visible "this feels different"
  moment.
- **Smoother pan/zoom** than typical JS canvases — the kind of thing
  that just _feels_ fast.
- **Tool switcher in the dialog** that lists all available tools (even
  unimplemented ones in coming-soon state) so users see the platform
  scope from day one.

These are technically quality features, but they're how the platform
_announces itself_ even when only one tool is shipped.

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
   expose this in v1 sketch tool, or punt to Phase 3? Punt.
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

### Phase 2 — Vector tool

This is where the platform starts to differentiate. No other ComfyUI
extension edits bezier paths.

- [ ] Implement `tools/vector.rs`: bezier path representation,
      control point editing
- [ ] Port `runebender-xilem` pieces (path types, hit-testing,
      selection, edit operations) — see `svg-editor.md`
- [ ] SVG import (`io/svg.rs` parse → kurbo `BezPath`)
- [ ] SVG export
- [ ] Pen, knife, select tools
- [ ] Tool switcher UI in dialog (sketch ↔ vector)
- [ ] Subsume `svg-editor.md` plan (this becomes the "tool" surface;
      the Assets-menu integration described in `svg-editor.md` is the
      trigger)
- [ ] Commit Phase 2

### Phase 3 — Composite tool

By the end of Phase 3 the dialog hosts three tools — the platform
identity is publicly visible.

- [ ] Implement `tools/composite.rs`: layer model with blend modes
- [ ] Layer panel UI in dialog (add image layer, opacity, blend
      mode dropdown, visibility toggle)
- [ ] Filter primitives: gaussian blur, brightness, contrast, hue
- [ ] Sample images bundled in `examples/composite-samples/`
- [ ] Tool switcher updated for three tools
- [ ] Commit Phase 3

### Phase 4 — Node widget (graph view)

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
- [ ] Commit Phase 4

### Phase 5 — App-mode input cell

- [ ] Research app-mode cell registration system (PR territory —
      may need bridge pattern to avoid PR conflicts)
- [ ] Build `LiteCanvasCell.vue` for app-mode panel
- [ ] Workflow author exposes canvas input → app-mode renders cell
- [ ] e2e test in app mode
- [ ] Commit Phase 5 (with care for PR sync)

## What this design deliberately does not include

- **Animation timeline** — sketch and compositor are static-frame
  tools. Animation is a different scope.
- **3D primitives** — Vello is 2D. If we ever want 3D, that's a
  different stack.
- **Plugin/scripting system for tools** — tools are first-class Rust
  modules in our crate. No runtime plugin API.
- **Color management UI for v1** — wide-gamut/HDR is supported by
  Vello but not exposed in user UI until Phase 3+.
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
- **App-mode integration (Phase 5) overlaps with PR territory.**
  Deferred to last for that reason; the engine and three tools all
  ship before we cross this bridge. By then the layered-architecture
  defenses (see `theme-system-design.md`) and the conflict-cheap
  patterns we've established make it tractable.

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
- Related plan (subsumed in Phase 2): `.agents/context/eli/svg-editor.md`
- Theme architecture (sync-overlap defense pattern):
  `.agents/context/eli/theme-system-design.md`
