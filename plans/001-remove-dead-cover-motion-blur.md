# 001 — Remove the cover motion blur that never applies

- **Status**: TODO
- **Commit**: 8d90252
- **Severity**: MEDIUM
- **Category**: Performance
- **Estimated scope**: 2 files, about 25 lines removed, 3 lines changed

## Problem

Commit `2c40a0a` ("Add subtle fluid motion blur to release covers") was meant to blur the cover images slightly while the page scrolls fast. It has never worked, and the owner has decided to **remove it**.

`js/cover-scroll.js` measures the scroll speed on every scroll event and writes it to `--scroll-motion-blur` on `<html>`:

```js
/* js/cover-scroll.js:32–53 — current */
  let lastY = window.scrollY;
  let lastTime = performance.now();
  let velocity = 0;
  let idleTimer = 0;
  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }
  function setVelocity(next) {
    const now = performance.now();
    const delta = Math.max(1, now - lastTime);
    const raw = (next - lastY) / delta * 16.667;
    lastY = next;
    lastTime = now;
    velocity = velocity * .8 + raw * .2;
    const strength = Math.min(1, Math.abs(velocity) / 80);
    document.documentElement.style.setProperty('--scroll-motion-blur', `${(strength * 2.2).toFixed(2)}px`);
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      velocity = 0;
      document.documentElement.style.setProperty('--scroll-motion-blur', '0px');
    }, 90);
    schedule();
  }
```

Nothing anywhere reads `--scroll-motion-blur`. The cover rule in the injected stylesheet sets its own `--motion-blur: 0px` and blurs by that, so the blur is always 0:

```js
/* js/cover-scroll.js:27 — current, the relevant part of the style.textContent string */
.release-cover { --motion-blur:0px; filter:blur(var(--motion-blur))!important; transition:filter .12s linear; will-change:filter; } @media(prefers-reduced-motion:reduce) { .cover-blur-copy { display:none; } .release-cover { --motion-blur:0px; filter:none!important; transition:none; will-change:auto; } }
```

The page still pays for it:

- Changing a custom property on `<html>` on every scroll event makes the browser recalculate styles for the whole page, plus a 90ms timer per event.
- `will-change: filter` on every cover keeps a separate compositing layer for each large image, for no visible effect.

`css/style.css:142` also carries a `filter` transition that only existed to keep this blur working:

```css
/* css/style.css:138–143 — current */
/* Photographic covers fade in once their image has loaded (js/main.js adds .is-loaded) */
img.release-cover {
  opacity: 0;
  /* keeps the scroll motion-blur transition from js/cover-scroll.js */
  transition: opacity 400ms var(--ease-out), filter .12s linear;
}
```

**Not part of this plan:** the blurred cover copies at the top and bottom edges of the viewport (`.cover-blur-copy`, positioned by `update()` in the same file). They are a separate, working effect and must stay exactly as they are.

## Target

- No scroll-speed tracking. The scroll listeners call the existing `schedule()` directly, which still updates the edge blur.
- No `filter`, `--motion-blur`, `transition` or `will-change` on `.release-cover` from `js/cover-scroll.js`.
- In `css/style.css`, the cover transition is opacity only:

```css
/* target — css/style.css */
/* Photographic covers fade in once their image has loaded (js/main.js adds .is-loaded) */
img.release-cover {
  opacity: 0;
  transition: opacity 400ms var(--ease-out);
}
```

## Repo conventions to follow

- `js/cover-scroll.js` injects its CSS as one long single-line string in `style.textContent`. Keep that format: edit the string in place, and don't split it into a separate file.
- Easing token: `--ease-out` is defined in `css/style.css` `:root`. This plan adds no new values.

## Steps

1. `js/cover-scroll.js:27`: in the `style.textContent` string, delete exactly this segment, including the trailing space:
   `.release-cover { --motion-blur:0px; filter:blur(var(--motion-blur))!important; transition:filter .12s linear; will-change:filter; } `
2. Same string: inside the reduced-motion block, delete exactly ` .release-cover { --motion-blur:0px; filter:none!important; transition:none; will-change:auto; }` so the block becomes `@media(prefers-reduced-motion:reduce) { .cover-blur-copy { display:none; } }`.
   Leave the leading `.release-cover { filter:none!important; }` at the start of the string untouched.
3. `js/cover-scroll.js:32–35`: delete the four lines `let lastY …`, `let lastTime …`, `let velocity = 0;`, `let idleTimer = 0;`.
4. `js/cover-scroll.js`: delete the whole `function setVelocity(next) { … }`, from `function setVelocity(next) {` through its closing `}`, just before `const observer = new IntersectionObserver`.
5. `js/cover-scroll.js` (around lines 117–124 before the deletions): replace both listeners.
   - Current:
     ```js
     window.addEventListener('scroll',() => {
       setVelocity(window.scrollY);
     },{ passive:true });
     ```
     and
     ```js
     window.visualViewport?.addEventListener('scroll',() => {
       setVelocity(window.scrollY);
     });
     ```
   - Target:
     ```js
     window.addEventListener('scroll',schedule,{ passive:true });
     ```
     and
     ```js
     window.visualViewport?.addEventListener('scroll',schedule);
     ```
6. `css/style.css:141–142`: delete the comment line `/* keeps the scroll motion-blur transition from js/cover-scroll.js */`, and change the transition to `transition: opacity 400ms var(--ease-out);`.
7. Search the repo (excluding `.agents/` and `plans/`) for `setVelocity`, `scroll-motion-blur`, `motion-blur`, `lastTime` and `idleTimer`. Expect no matches.

## Boundaries

- Do NOT touch `update()`, `register()`, the `IntersectionObserver`, or any `.cover-blur-copy` rule. The edge blur stays.
- Do NOT touch the second IIFE in `js/cover-scroll.js` (the header nav collapse, which starts with `const header = document.getElementById('site-header')`).
- Do NOT change the reduced-motion rule `img.release-cover { transition: opacity 150ms var(--ease-out); }` in `css/style.css`.
- Do NOT add dependencies.
- If the code you find doesn't match the excerpts above, STOP and report instead of improvising.

## Verification

- **Mechanical**:
  - `node --check js/cover-scroll.js` passes.
  - The searches in step 7 come back empty.
- **Feel check**: serve the site (`python3 -m http.server`) and open `index.html`.
  - Scroll quickly through several releases. The covers look exactly as before: sharp, with the soft blurred band at the top and bottom of the viewport following the scroll.
  - Covers still fade in on first load.
  - DevTools → Performance: record 5 seconds of fast scrolling. Compared with before, there are fewer and shorter "Recalculate Style" entries per scroll event. Elements → `<html>`: no `style="--scroll-motion-blur…"` appears while scrolling.
  - DevTools → Layers: cover images no longer each have their own layer from `will-change`.
- **Done when**:
  - The searches are empty.
  - The edge blur still tracks the scroll.
  - No `filter` transition remains on `.release-cover`.
