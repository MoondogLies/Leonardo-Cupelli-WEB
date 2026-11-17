# Leonardo Cupelli — Portfolio

Static portfolio for composer Leonardo Cupelli, designed for GitHub Pages.

## Structure

- `index.html` — main page
- `css/style.css` — layout and branded streaming buttons
- `js/main.js` — release rendering and service logos
- `data/releases.json` — release data and streaming links
- `covers/` — square release artwork

## Add a release

Add a new object at the top of the array in `data/releases.json`. Releases are displayed from newest to oldest; even-numbered releases automatically reverse the cover/content alignment.

Replace each service URL with the direct release URL. The buttons use the official brand colors and closest permitted system fonts for Spotify, Bandcamp, Apple Music and YouTube.
