# Animation plans

Written by the `improve-animations` skill from an audit of the site's motion at commit `8d90252`. Each plan is self-contained: any agent or person can execute it without the audit conversation.

| # | Plan | Severity | Status |
|---|---|---|---|
| 001 | [Remove the cover motion blur that never applies](001-remove-dead-cover-motion-blur.md) | MEDIUM | DONE |
| 002 | [Scroll cue: no movement with reduced motion](002-scroll-cue-reduced-motion.md) | MEDIUM | DONE |
| 003 | [Header links: grow on hover only with a mouse](003-header-hover-scale-pointer-only.md) | MEDIUM | TODO |
| 004 | [Use the `--ease-out` token instead of hand-typed copies](004-use-ease-out-token.md) | LOW | TODO |

## Execution order

1. **001**
2. **002**
3. **003**
4. **004**

## Dependencies

- **004 depends on 003:** both edit `css/header-interactions.css`, and 003 deletes one of the copies 004 would otherwise list. Both also bump the same version strings.
- **001 and 004** both touch `js/cover-scroll.js`, but different parts of it (line 27 and the velocity code, versus line 143), so order between them doesn't matter.
- **002** is independent.

## Audit findings not planned

- **Discography slide and Contacts fade at the bottom of the page** (`js/cover-scroll.js:143`): 450ms, ease-out. Suggested: `translate 280ms cubic-bezier(0.77, 0, 0.175, 1)`, with the Contacts fade-out at 200ms `var(--ease-out)`.
- **Back-to-top arrow fade** (`css/header-interactions.css:10`, `index.html:23`): `opacity .3s ease`. Suggested: `opacity 200ms var(--ease-out)`.
- **Strengthening `--ease-out`** to `cubic-bezier(0.23, 1, 0.32, 1)`: the owner chose to keep the current curve.
