# Figma & Doc Cleanup — Todo

Status: draft. Owner: Eli. Companion to [`theme-system-research.md`](./theme-system-research.md)
and [`theme-system-design.md`](./theme-system-design.md).

Two cleanups, listed separately because they're different scopes:

1. **Figma rip-out.** Every reference, full stop. Small, surgical.
2. **Doc culling.** Upstream-inherited documentation that doesn't apply
   to a design-engineer-focused lite fork. Larger, judgment calls
   needed — flag with `[review]` where I'm not sure.

## 1. Figma rip-out — exhaustive list

These are every file containing the string "figma" (case-insensitive)
that I found in the repo, with the action to take.

### `AGENTS.md`

Three locations, all instructional ("consult Figma," "use the Figma
MCP," "Comfy Design Standards" link).

- **L185–187** — entire "Design Standards" section (the paragraph that
  starts "Before implementing any user-facing feature, consult the
  Comfy Design Standards Figma file…"). **Delete.** Replace with one
  line: `See .agents/context/eli/theme-system-design.md for token names
  and the in-code design system.`
- **L236** — the bullet `- Comfy Design Standards: <https://www.figma.com/...>`
  in the External Resources list. **Delete the bullet.**

### `docs/guidance/design-standards.md`

The whole 66-line file is a Figma-MCP playbook. **Delete the file.**

That deletion will break the AGENTS.md cross-reference at L187 too — handled
by the AGENTS.md edit above.

### `src/platform/cloud/onboarding/assets/css/fonts.css`

Two comments:

- L24: `/* Figma-like hero style */`
- L31: `/* Figma has leading-trim/text-edge which CSS doesn't support; emulate with tight line-height */`

These are *descriptive* comments, not source-of-truth pointers. **Either
delete both comments or rephrase to drop "Figma."** L31 has actual
information value (explains why the line-height is tight); rewrite to
`/* leading-trim/text-edge isn't in CSS yet; emulate with tight line-height */`.

### `.claude/skills/writing-storybook-stories/SKILL.md`

Three locations:

- **L15** — "If a Figma link is provided, list the states you need to
  cover before writing stories." → **Delete or replace** with a more
  generic "list the states you need to cover before writing stories."
- **L108** — `## Figma Mapping` heading. **Delete the section** (probably
  several paragraphs — confirm by reading).
- **L114** — "If a Figma state cannot be represented exactly, capture
  the closest prop-driven version and explain the gap in the story
  docs." → **Delete or generalize.**

[review] This is a Claude skill file. If we're keeping the skill at all,
the cleaner move is: read the whole file, decide whether the skill
itself is useful for this fork, and either trim Figma references or
delete the skill outright.

### `docs/adr/0003-crdt-based-layout-system.md`

One reference: a citation to "Figma's Multiplayer Technology" blog
post in a references section. This is fine to keep — it's a citation,
not an instruction to fetch design tokens. **No action needed**, unless
the whole ADR gets deleted as upstream cruft (see §2 below).

### Verification sweep after edits

```bash
grep -rln -i "figma" \
  src/ scripts/ .github/ docs/ .claude/ apps/ packages/ \
  AGENTS.md CLAUDE.md CONTRIBUTING.md README.md TROUBLESHOOTING.md
```

Should return:

- `src/platform/cloud/onboarding/assets/css/fonts.css` (if we kept the
  rephrased L31 comment without the word "Figma," empty)
- `docs/adr/0003-crdt-based-layout-system.md` (citation only — fine)

…and nothing else.

## 2. Doc culling — upstream baggage

The lite fork is a personal, opinionated demo project. Most of the
upstream documentation tree assumes a multi-team product context with
release processes, ADR governance, contributor onboarding, etc. Most of
it should go. Anything we delete is recoverable from upstream's git
history if we ever want it back.

Format: file → recommendation → reason.

### Definitely delete

| File | Reason |
|------|--------|
| `docs/guidance/design-standards.md` | Figma playbook — see §1. |
| `docs/release-process.md` | Upstream release/ship cadence; the lite fork doesn't ship releases. |
| `docs/TEMPLATE_RANKING.md` | Upstream-only feature governance. |
| `docs/FEATURE_FLAGS.md` | Upstream-only growth/rollout machinery. |
| `docs/SETTINGS.md`, `docs/SETTINGS_SEQUENCE_DIAGRAM.md` | Settings-system internals doc; if we redesign settings (likely), this is stale anyway. |
| `docs/WIDGET_SERIALIZATION.md` | Upstream serialization spec; stays relevant only if we keep the upstream widget system unchanged. |
| `CODEOWNERS` | Multi-team ownership; one-person fork doesn't need it. |
| `.coderabbit.yaml` | Upstream CI bot config. |

### Probably delete (judgment call)

[review] Each of these is non-trivial in size and might still be useful
if we want to think carefully about a subsystem. Default: delete.
Override only with a specific reason.

| File / dir | Default | Why hesitate |
|-----------|---------|--------------|
| `docs/adr/` (entire dir, 9 files) | Delete | One ADR (0003 CRDT layout) might inform an interesting architecture; rest are upstream policy. Could keep `0003`-only. |
| `docs/architecture/` (10 ECS-related files) | Delete | Documents an in-progress upstream initiative (entity-component-system migration). Lite fork is unlikely to follow that path; if it does we'll plan it ourselves. |
| `docs/extensions/` | [review — haven't read] | Extension API matters for ecosystem; for a personal fork, less so. |
| `docs/testing/` | Keep | Useful patterns for our own tests. |
| `docs/guidance/{playwright,storybook,typescript,vitest,vue-components}.md` | Keep | File-type-specific conventions auto-loaded by AGENTS.md globs; small and useful. |
| `CONTRIBUTING.md` | Delete | Upstream contributor flow; this fork is one person. |
| `TROUBLESHOOTING.md` | [review] | If it documents environment quirks (Node versions, pnpm gotchas) keep; if it's product support, delete. |
| `README.md` | Rewrite, don't delete | Currently 17KB describing upstream; should describe the lite fork in a paragraph or two. |

### Keep (no action)

- `AGENTS.md` (after Figma scrub) — but worth a longer pass to remove
  references to the multi-team product context (e.g., the
  "thousands of users and extensions" framing in *Project Philosophy*
  doesn't match a personal fork).
- `CLAUDE.md` — one line, pulls in AGENTS.md.
- `docs/testing/`
- `docs/guidance/*.md` (except `design-standards.md`)

### After the cull

The `docs/` tree should look something like:

```
docs/
  guidance/
    playwright.md
    storybook.md
    typescript.md
    vitest.md
    vue-components.md
  testing/
    ...
```

If we keep ADR 0003 it's its own subdir or a sibling file. Everything
else lives in `.agents/context/eli/` (Eli's planning material).

## 3. Code references to upstream concepts that may follow

Not strictly Figma, but the same "remove what doesn't fit a personal
fork" principle:

- The `original-8188-model-filter.png` at the repo root looks like a
  reference screenshot from an upstream PR. Likely [delete].
- `comfyui_frontend_package/` exists for shipping the frontend as an
  npm package — verify whether the lite fork needs to publish at all.
  If not, [delete].
- `apps/desktop-ui/` is the Electron desktop wrapper. Personal fork
  context: probably keep web-only, delete desktop. [review]

These are out of scope for the theme cleanup but listed here so they
don't get forgotten.

## Resolved — context directory layout

Eli chose to consolidate under `.agents/context/eli/` so personal
planning material is segregated from any agent-written context that
may accumulate at `.agents/context/`. As of this revision the layout is:

```
.agents/context/
  README.md                  # generic explainer for the dir
  eli/                       # all of Eli's planning material
    svg-editor.md
    vectorizer-node.md
    theme-system-research.md
    theme-system-design.md
    figma-removal-todo.md
```

The top-level `context/` directory has been removed.

## Execution order

When we actually do this work (separate from drafting these docs):

1. Verify each doc-deletion item against the file's actual content
   (one read pass per file). Some `[review]` items may flip.
2. Make the Figma scrub edits in §1 in a single commit:
   `chore: remove Figma references from docs and agent rules`.
3. Make the doc-cull deletions in a single commit per category
   (definitely-delete, probably-delete) so each is reviewable in
   isolation.

The theme rewrite itself (per `theme-system-design.md`) is independent
and can land in parallel.
