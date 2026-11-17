# Leonardo Cupelli — Portfolio

Static portfolio for composer Leonardo Cupelli, designed for GitHub Pages.

## Structure

- `index.html` — main page
- `css/style.css` — layout and visual style
- `js/main.js` — release rendering and streaming-service tabs
- `data/releases.json` — release data and official embed URLs
- `covers/` — square release artwork

## Add a release

Add a new object at the top of the array in `data/releases.json`. Releases are displayed from newest to oldest; even-numbered releases automatically reverse the cover/content alignment.

Replace the placeholder embed IDs with the official release IDs from Spotify, Bandcamp, Apple Music and YouTube.
