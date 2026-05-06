# Vectorizer Node — planning

Status: draft. Owner: Eli. Companion to [`svg-editor.md`](./svg-editor.md).

## Motivation

The local ComfyUI install (`~/Work/comfy/repos/ComfyUI`) has no SVG-native
models — all installed checkpoints/LoRAs produce raster output. To get
SVGs into app-mode output panels (where the planned bezier editor
lives), we need a step that converts raster tensors into SVG with cubic
bezier paths.

A ComfyUI custom node wrapping **img2bez** is the natural fit:

- Eli's own crate (https://github.com/eliheuer/img2bez), MIT-licensed.
- Linebender stack — kurbo `BezPath` is the same type the editor will
  consume. In a shared-Rust pipeline (future state) curves can flow
  end-to-end without an SVG round-trip.
- Optimal curve fitting via kurbo's `fit_to_bezpath_opt`.
- Owned by us — any limitations we hit, we fix upstream in img2bez
  rather than working around a third-party tool.

## What img2bez is today

Library API (from `src/lib.rs`):

```rust
pub fn trace(path: &Path, config: &TracingConfig) -> Result<TraceResult, TraceError>
// TraceResult.paths: Vec<kurbo::BezPath>
```

Capabilities:
- Bitonal (Otsu threshold by default; fixed threshold optional)
- Polygon optimization → optimal cubic-bezier fitting
- UFO output as a feature-gated module (we don't use that path here)
- Renders `Vec<BezPath>` — no SVG writer yet

Limitations relative to a general raster→SVG vectorizer:
- **B&W only.** Single foreground/background segmentation per call.
- **No SVG output yet.** Need to add an SVG writer (kurbo `BezPath` →
  SVG `d` attribute is trivial — one short function per path).
- **No Python bindings yet.** Need a way to call from a ComfyUI node.

## v1 scope: B&W tracing

v1 is **black-and-white** SVG output. That's what img2bez does today
and it's enough to exercise the editor end-to-end (raster output →
vectorize → preview → edit a curve → save).

Color support is real follow-on work (M5+ in milestones below). Two
plausible paths when we get there:

1. **In img2bez**: proper layered tracing (color quantization in Rust,
   per-layer trace, composite). Cleaner architecture, slower to ship.
2. **In the wrapper**: color-quantize in Python, mask per layer, call
   `trace()` once per mask, composite SVGs in the wrapper. Faster to
   ship, less elegant.

Defer the choice; the v1 wrapper API is the same either way.

## Work to do in img2bez

Two additions, in order:

1. **SVG writer.** Add an `svg` feature alongside the existing `ufo`
   feature. Expose:
   ```rust
   pub fn trace_to_svg(path: &Path, config: &TracingConfig) -> Result<String, TraceError>;
   // and/or
   pub fn paths_to_svg(paths: &[BezPath], width: f64, height: f64) -> String;
   ```
   Implementation is ~40 lines: walk `BezPath` elements (`MoveTo`,
   `LineTo`, `CurveTo`, `ClosePath`) and emit the SVG `d` attribute.
2. **Python bindings.** Two options:
   - **PyO3 + maturin** in img2bez (gated behind a `python` feature),
     OR a sibling `img2bez-py` crate that depends on img2bez. Ships a
     real wheel; clean DX. **Recommended.**
   - **CLI shell-out**: add `--emit svg` flag → SVG to stdout, the
     Python node calls the binary. v0 hack to unblock prototyping.

Plan: ship CLI shell-out alongside the SVG writer in M1, add PyO3
bindings in M2 once the node exists and we know what API shape we want.

## Repo / install layout

Three repos:

| Repo | Role | Status |
|------|------|--------|
| `img2bez` | Rust core: tracing + SVG writer + Python bindings | Exists; needs SVG writer + bindings |
| `comfy-img2bez-node` | Python ComfyUI custom node | New |
| `ComfyUI_Lite_frontend` (this repo) | Frontend + planning docs + SVG editor | Exists |

`comfy-img2bez-node` repo layout:

```
~/GH/repos/comfy-img2bez-node/
  pyproject.toml
  README.md
  LICENSE                 # GPLv3 to match the rest of Eli's stack
  comfy_img2bez/
    __init__.py           # NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS
    vectorize.py          # the VectorizeImage node
    save_svg.py           # SaveSVG node
    preview_svg.py        # PreviewSVG node (TBD — see open question 1)
  requirements.txt        # img2bez (wheel) once bindings exist; pillow, etc.
  tests/
```

### Local dev install

Keep the source at `~/GH/repos/comfy-img2bez-node/` and symlink into the
ComfyUI custom_nodes dir so edits go live on restart:

```bash
ln -s ~/GH/repos/comfy-img2bez-node \
      ~/Work/comfy/repos/ComfyUI/custom_nodes/comfy-img2bez-node
```

Same pattern works for `~/GH/repos/img2bez` if we want to test wheel
changes locally before publishing.

## Node design

### Inputs

- `image: IMAGE` — standard ComfyUI image tensor
- `accuracy: FLOAT` — default 4.0; img2bez `--accuracy` (curve fit
  tolerance, smaller = tighter)
- `alphamax: FLOAT` — default 1.0; img2bez `--alphamax` (corner
  detection; 0.6–0.8 geometric, 1.0 organic)
- `smooth: INT` — default 3; polygon smoothing iterations
- `threshold: INT (-1 = Otsu)` — fixed brightness threshold or auto
- `invert: BOOLEAN` — default false
- `grid: INT` — default 0 (off); coordinate snapping

(Mirrors img2bez's CLI flags. Most users only ever touch `accuracy` and
`alphamax`; rest are advanced.)

### Outputs

- `svg: STRING` — raw SVG markup

Using `STRING` (not a custom `SVG` type) for v1 — composable with
existing string-handling nodes, avoids inventing a type the rest of
ComfyUI doesn't understand. Promote to a proper `SVG` type only if 2–3
more SVG-aware nodes start sharing structure.

### Companion: SaveSVG node

Trivial — takes `STRING` + filename, writes to disk. Mirrors ComfyUI's
`SaveImage`.

### Companion: PreviewSVG node (open question)

App-mode output panels render specific node output types. Need to read
the app-mode output panel code to confirm whether a STRING output
surfaces in the panel and whether we need a dedicated `PreviewSVG` node
whose output the panel recognizes as `image/svg+xml`. **This is the
integration seam with `svg-editor.md`.**

## Implementation sketch

Once img2bez ships PyO3 bindings:

```python
# vectorize.py
import img2bez
import numpy as np
from PIL import Image
import io, tempfile, os

class VectorizeImage:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "accuracy": ("FLOAT", {"default": 4.0, "min": 0.1}),
                "alphamax": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 1.5}),
                "smooth": ("INT", {"default": 3, "min": 0}),
                "threshold": ("INT", {"default": -1, "min": -1, "max": 255}),
                "invert": ("BOOLEAN", {"default": False}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("svg",)
    FUNCTION = "vectorize"
    CATEGORY = "image/vector"

    def vectorize(self, image, accuracy, alphamax, smooth, threshold, invert):
        # ComfyUI image tensors are [B, H, W, C], float [0,1]
        if image.shape[0] != 1:
            raise ValueError("VectorizeImage: batch size > 1 not supported in v1")
        arr = (image[0].cpu().numpy() * 255).astype(np.uint8)
        config = img2bez.TracingConfig(
            accuracy=accuracy, alphamax=alphamax,
            smooth=smooth, threshold=threshold, invert=invert,
        )
        svg = img2bez.trace_array_to_svg(arr, config)
        return (svg,)
```

(Function/method names are illustrative — pin them when we design the
PyO3 surface in M2.)

For the M1 prototype before bindings exist, do the same flow via a
temporary file + subprocess to the `img2bez --emit svg` CLI.

## Integration with the SVG editor

```
[raster model] → IMAGE → [VectorizeImage] → SVG (STRING) → [PreviewSVG] → output panel
                                                                              ↓
                                                                       [edit button]
                                                                              ↓
                                                                  SVG editor overlay
                                                                  (per svg-editor.md)
```

Save semantics (commit-in-place vs. branch the run vs. trigger
re-execution) is the same open question as in `svg-editor.md` item 1.

## Open questions

1. **PreviewSVG necessity.** Does the app-mode output panel render a
   STRING output as SVG natively, or does it need a dedicated node with
   an `image/svg+xml`-flagged output? Read the app-mode output panel
   code to answer.
2. **Bindings strategy.** PyO3 in `img2bez` (gated by `python` feature)
   vs sibling `img2bez-py` crate. Sibling crate keeps the core lean;
   feature-gated keeps it one repo. Probably feature-gated.
3. **CLI v0 fallback.** Ship the `--emit svg` flag in img2bez and the
   subprocess path in the Python node so M1 doesn't block on bindings?
   Probably yes.
4. **Tensor shape.** Batch > 1 — vectorize per-frame and emit a list,
   or only support B=1? Start B=1, error otherwise.
5. **Alpha handling.** RGBA inputs — flatten to RGB on a configurable
   background, or pass through? img2bez expects bitonal; flatten with
   white background is the safe default.
6. **Color support roadmap.** When we add color, do it in img2bez
   (proper layered tracing) or in the wrapper (color-quantize +
   per-mask trace + composite)? Defer; v1 doesn't depend on it.

## Milestones

1. **M1 — img2bez SVG export + CLI hello.** Add SVG writer feature in
   img2bez. Add `--emit svg` CLI flag. New `comfy-img2bez-node` repo
   stubs out a `VectorizeImage` node that shells out to the CLI and
   returns SVG. Confirms the wiring end-to-end.
2. **M2 — PyO3 bindings.** Add Python bindings to img2bez. Drop the
   subprocess call in favor of in-process Rust. Wheel-builds via
   maturin.
3. **M3 — Save + Preview nodes.** SaveSVG writes to disk. PreviewSVG
   surfaces the SVG to the app-mode output panel correctly (whatever
   that requires — see open question 1).
4. **M4 — pair with editor.** End-to-end demo: raster model →
   vectorize → preview → edit button → modify a curve → save.
5. **M5 — color support.** Path TBD per open question 6.

M1–M4 is the MVP that exercises the editor end-to-end (B&W only). M5
unlocks color.

## References

- img2bez (source): https://github.com/eliheuer/img2bez
  - Local: `/Users/eli/GH/repos/img2bez`
- ComfyUI custom node docs:
  https://docs.comfy.org/essentials/custom_node_overview
- Reference custom node in this user's stack:
  `~/Work/comfy/repos/ComfyUI/custom_nodes/comfyfont/` (similar shape:
  Python nodes + JS extension + a workspace concept)
- maturin (PyO3 wheel builder): https://www.maturin.rs/
- Companion plan: [`svg-editor.md`](./svg-editor.md)
