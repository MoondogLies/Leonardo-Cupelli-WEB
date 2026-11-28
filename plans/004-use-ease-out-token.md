# 004 — Use the `--ease-out` token instead of hand-typed copies

- **Status**: TODO
- **Commit**: 8d90252
- **Severity**: LOW
- **Category**: Cohesion & tokens
- **Estimated scope**: 3 files, 5 values replaced
- **Depends on**: 003 (it edits the same file, `css/header-interactions.css`; run 003 first)

## Problem

The site's easing curve is defined once as a token:

```css
/* css/style.css :root — current */
  --ease-out: cubic-bezier(.22, .61, .36, 1);
```

The same curve is still typed out by hand in several places. If someone ever tunes the token, these would silently stay behind.

```css
/* css/style.css (view transition, around line 38) — current */
  animation-timing-function: cubic-bezier(.22, .61, .36, 1);
```

```css
/* css/header-interactions.css:5 — current */
  transition: transform .3s cubic-bezier(.22,.61,.36,1);
/* css/header-interactions.css:10 — current */
  transition: transform .3s cubic-bezier(.22,.61,.36,1), opacity .3s ease, visibility 0s linear .3s;
```

```js
/* js/cover-scroll.js:143, inside the style.textContent string — current */
.site-nav .nav-discography { translate:0 0; transition:translate .45s cubic-bezier(.22,.61,.36,1),transform .3s cubic-bezier(.22,.61,.36,1); }
```

The copy in `css/style.css` at `.site-nav a { transition: … }` is deleted by plan 003, so it is not listed here.

## Target

Every copy reads `var(--ease-out)`. **The curve itself does not change**: the owner chose to keep `.22, .61, .36, 1`. Durations do not change either.

```css
/* target */
  animation-timing-function: var(--ease-out);                                        /* style.css, view transition */
  transition: transform .3s var(--ease-out);                                         /* header-interactions.css:5 */
  transition: transform .3s var(--ease-out), opacity .3s ease, visibility 0s linear .3s; /* header-interactions.css:10 */
```

```js
/* target — js/cover-scroll.js:143 segment */
.site-nav .nav-discography { translate:0 0; transition:translate .45s var(--ease-out),transform .3s var(--ease-out); }
```

`var()` works in all of these places:

- Both pages load `css/style.css`, which defines the token on `:root`.
- The view-transition pseudo-elements inherit custom properties from `<html>`.

## Repo conventions to follow

- Existing users of the token, to imitate: `css/style.css` (`img.release-cover` transition, `.stream-link` transition) and `css/archive.css` (`.archive-entry` animation).

## Steps

1. `css/style.css`: inside `::view-transition-old(root), ::view-transition-new(root) { … }`, change `animation-timing-function: cubic-bezier(.22, .61, .36, 1);` to `animation-timing-function: var(--ease-out);`.
2. `css/header-interactions.css`:
   - Line 5: change `cubic-bezier(.22,.61,.36,1)` to `var(--ease-out)`.
   - Line 10: change the single `cubic-bezier(.22,.61,.36,1)` to `var(--ease-out)`.
   - Leave `opacity .3s ease` and `visibility 0s linear .3s` as they are.
3. `js/cover-scroll.js:143`: in the `style.textContent` string, change both `cubic-bezier(.22,.61,.36,1)` occurrences to `var(--ease-out)`. Change nothing else in that string.
4. `css/grain.css:1`: bump the import to `header-interactions.css?v=3`. If plan 003 was not run, it reads `?v=1`; set it to `?v=2` instead.
5. `releases.html`: bump `css/style.css?v=N` and `css/grain.css?v=N` by one each.

## Boundaries

- Do NOT change the value of `--ease-out` in `:root`.
- Do NOT change any duration, or the `ease` / `linear` keywords.
- Do NOT touch `.agents/`, `plans/`, or `js/dattilogramma-scroll.js`.
- If the code you find doesn't match the excerpts above, STOP and report.

## Verification

- **Mechanical**:
  - `grep -rn "cubic-bezier(.22" css js index.html releases.html` shows exactly one match: the `--ease-out` definition in `css/style.css`.
  - `node --check js/cover-scroll.js` passes.
- **Feel check**: serve the site (`python3 -m http.server`).
  - Nothing should look or feel different. Hover the header links, then scroll to the very bottom of the contact section and watch Discography slide over as Contacts fades out. Move between the two pages for the crossfade.
  - In DevTools → Animations at 10% speed, check one hover and one view transition: the curve shown is `cubic-bezier(0.22, 0.61, 0.36, 1)`, not `ease`. That shows the `var()` resolved.
- **Done when**:
  - The grep shows only the token definition.
  - The motion is visibly unchanged.
