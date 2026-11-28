# 003 — Header links: grow on hover only with a mouse

- **Status**: TODO
- **Commit**: 8d90252
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 4 files, about 20 lines changed

## Problem

The header links grow to 108% on `:hover` on every device:

- Discography and Contacts on the home page.
- The back-to-top arrow (`.header-top`).
- The back arrow on the Discography page (`.back-home`).

Phones fire a hover on tap and keep it. Tapping **Contacts** scrolls within the same page, so the link stays enlarged afterwards until the user taps somewhere else.

```css
/* css/header-interactions.css:13–22 — current */
.site-header .site-nav a:hover,
.site-header .site-nav a:focus-visible,
.site-header .header-top:hover,
.site-header .header-top:focus-visible,
.archive-header .back-home:hover,
.archive-header .back-home:focus-visible {
  color: inherit;
  transform: scale(1.08);
  text-decoration: none;
}
```

`css/style.css` also has an older copy of the nav rules. The more specific rules above already override it, so it does nothing except mislead:

```css
/* css/style.css:87–94 — current, redundant */
.site-nav a {
  transition: transform .3s cubic-bezier(.22,.61,.36,1);
}

.site-nav a:hover,
.site-nav a:focus-visible {
  transform: scale(1.08);
}
```

## Target

- The growth on **hover** happens only with a mouse or trackpad.
- The growth on **keyboard focus** (`:focus-visible`) stays on every device.
- `color: inherit` and `text-decoration: none` keep applying on hover and focus everywhere, exactly as now.

```css
/* target — css/header-interactions.css, replacing the block at lines 13–22 */
.site-header .site-nav a:hover,
.site-header .site-nav a:focus-visible,
.site-header .header-top:hover,
.site-header .header-top:focus-visible,
.archive-header .back-home:hover,
.archive-header .back-home:focus-visible {
  color: inherit;
  text-decoration: none;
}
.site-header .site-nav a:focus-visible,
.site-header .header-top:focus-visible,
.archive-header .back-home:focus-visible {
  transform: scale(1.08);
}
@media (hover: hover) and (pointer: fine) {
  .site-header .site-nav a:hover,
  .site-header .header-top:hover,
  .archive-header .back-home:hover {
    transform: scale(1.08);
  }
}
```

Separately, delete the redundant `.site-nav a` / `.site-nav a:hover, .site-nav a:focus-visible` rules from `css/style.css`. Then bump the cache-busting versions so returning visitors fetch the changed `header-interactions.css`. It is loaded through an `@import` in `css/grain.css`.

## Repo conventions to follow

- Pointer gating is already done this way for the streaming buttons. Search `css/style.css` for `@media (hover: hover) and (pointer: fine)` near `.stream-link:hover` and imitate that pattern.
- Stylesheet versions are query strings (`?v=N`) on the URL that loads them.

## Steps

1. `css/header-interactions.css`: replace the block shown in "Problem" (lines 13–22) with the target CSS above. Leave the rest of the file as it is, including the `@media (prefers-reduced-motion: reduce)` block at the end.
2. `css/style.css`: delete the two rules shown above, `.site-nav a { transition: … }` and `.site-nav a:hover, .site-nav a:focus-visible { transform: scale(1.08); }`, plus the blank line between them. They sit just after the `.site-nav { … }` rule and before `.viewport-fade`. Keep `.site-nav { … }` itself.
3. `css/grain.css:1`: change `@import url('./header-interactions.css?v=1');` to `@import url('./header-interactions.css?v=2');`.
4. `releases.html`:
   - Change `<link rel="stylesheet" href="css/grain.css?v=2">` to `?v=3`.
   - Change `css/style.css?v=4` to `css/style.css?v=5`.
   - `index.html` loads both without a version; leave it.

## Boundaries

- Do NOT change any transition durations or curves here. Plan 006 handles the curve literals in this file.
- Do NOT touch the inline `<style>` in `index.html`.
- Do NOT gate `:focus-visible`; keyboard users must keep the cue.
- If the code you find doesn't match the excerpts above, STOP and report.

## Verification

- **Mechanical**: `grep -n "scale(1.08)" css/*.css` shows matches only in `css/header-interactions.css`, inside the `:focus-visible` rule and the hover media query.
- **Feel check**: serve the site (`python3 -m http.server`).
  - Desktop with a mouse: hovering Discography, Contacts, the back-to-top arrow and the Discography page's back arrow still grows each to 108%, smoothly.
  - Keyboard: Tab to each link. It grows while focused.
  - Phone, or DevTools device emulation with touch: tap **Contacts**. The page scrolls to the contact section and the link is **not** left enlarged.
- **Done when**:
  - No header link stays enlarged after a tap on touch devices.
  - Mouse hover and keyboard focus behave as before.
