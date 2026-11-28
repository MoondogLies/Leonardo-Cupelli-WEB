# 002 — Scroll cue: no movement with reduced motion

- **Status**: TODO
- **Commit**: 8d90252
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 1 file, about 10 lines added

## Problem

The scroll cue is the small chevron at the bottom of every release. It bobs up and down forever and ignores the reduced-motion setting, so people who asked their system for less motion still see constant movement on every screen.

```css
/* css/style.css:300–322 — current */
.scroll-cue {
  position: absolute;
  bottom: 18px;
  left: 50%;
  transform: translateX(-50%);
  width: 22px;
  height: 22px;
  color: var(--muted);
  opacity: .75;
  pointer-events: none;
  animation: scroll-cue 2.4s ease-in-out infinite;
}

@keyframes scroll-cue {
  0%, 100% { transform: translate(-50%, 0); opacity: .45; }
  50% { transform: translate(-50%, 6px); opacity: .9; }
}
```

## Target

Reduced motion means gentler, not zero. Keep the opacity pulse, which still says "there's more below", and drop the 6px movement. The transform stays at `translateX(-50%)` so the cue remains centred.

```css
/* target — add directly after the existing @keyframes scroll-cue block */
@keyframes scroll-cue-fade {
  0%, 100% { opacity: .45; }
  50% { opacity: .9; }
}

@media (prefers-reduced-motion: reduce) {
  .scroll-cue { animation-name: scroll-cue-fade; }
}
```

Duration (2.4s), timing (`ease-in-out`) and `infinite` are inherited from the existing shorthand. This is constant, gentle on-screen motion, so `ease-in-out` is the correct curve.

## Repo conventions to follow

- Reduced-motion overrides sit in a `@media (prefers-reduced-motion: reduce)` block right after the rules they change. Example: `css/style.css`, the `release-enter` / `release-enter-fade` pair (search for `@keyframes release-enter-fade`). Imitate that pair's naming: `<name>` and `<name>-fade`.

## Steps

1. In `css/style.css`, find the block `@keyframes scroll-cue { … }` (around line 319).
2. Directly after its closing `}`, insert the target CSS above exactly.

## Boundaries

- Do NOT change the existing `.scroll-cue` rule, the existing `@keyframes scroll-cue`, or the mobile `.scroll-cue` override inside `@media (max-width: 860px)`.
- Do NOT change `js/main.js`, where the cue markup lives.
- If the code you find doesn't match the excerpts above, STOP and report.

## Verification

- **Mechanical**: `grep -n "scroll-cue-fade" css/style.css` shows the keyframes and the media rule.
- **Feel check**: serve the site (`python3 -m http.server`) and open `index.html`.
  - Normally, the chevron still bobs 6px and pulses, exactly as before.
  - DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion: reduce": the chevron stays still and centred, and only fades between dim and brighter.
  - Check on a narrow viewport (under 860px) too: still centred, still still.
- **Done when**: with reduced motion on, the chevron's position never changes, and it still pulses in opacity.
