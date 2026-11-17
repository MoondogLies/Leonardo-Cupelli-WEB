# Leonardo Cupelli — Portfolio

Static portfolio for composer Leonardo Cupelli, designed for GitHub Pages.

## Structure

- `index.html` — main page
- `css/style.css` — layout and branded streaming buttons
- `js/main.js` — release rendering, web cover lookup and service logos
- `data/releases.json` — release data and streaming links
- `covers/` — optional local fallback artwork

## Cover artwork

The site searches Apple Music/iTunes using each release’s `searchTerm`, then displays the highest available 1200 × 1200 artwork. If the lookup fails, it falls back to the local image defined in `cover`.

For a production site, save a local copy of each cover in `covers/` and use it as the primary source.

## Add a release

Add a new object at the top of the array in `data/releases.json`. Releases are displayed from newest to oldest; even-numbered releases automatically reverse the cover/content alignment.

Replace each service URL with the direct release URL. The buttons use the official brand colors and closest permitted system fonts for Spotify, Bandcamp, Apple Music and YouTube.
