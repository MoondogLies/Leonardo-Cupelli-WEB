async function loadReleases() {
  const container = document.getElementById("release-list");
  const response = await fetch("data/releases.json");
  const releases = await response.json();

  container.innerHTML = releases.map(release => release.animation ? animatedRelease(release) : `
    <article
      class="release"
      data-spotify-url="${encodeURIComponent(release.spotifyReleaseUrl)}"
      data-fallback-cover="${release.cover}"
      data-header-tone="${release.headerTone || "dark"}">
      <img class="release-cover" alt="Cover art for ${release.title}" crossorigin="anonymous">

      ${releaseContent(release)}

      ${scrollCue}
    </article>
  `).join("");

  // first screen of the visit: its text settles in instead of appearing all at once (css/style.css)
  container.querySelector(".release")?.classList.add("is-entering");

  const articles = [...container.querySelectorAll(".release")];
  articles.forEach(article => {
    if (!article.classList.contains("release--animated")) loadSpotifyCover(article);
  });

  updateHeaderContrast(articles);
  window.addEventListener("scroll", () => updateHeaderContrast(articles), { passive: true });
  window.addEventListener("resize", () => updateHeaderContrast(articles));
}

const scrollCue = `
      <div class="scroll-cue" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 9l6 6 6-6"></path>
        </svg>
      </div>`;

// A release whose cover is the Dattilogramma: the section is several screens tall, the cover and
// text stay pinned while the text decomposes; halfway through, the square sheet starts to appear
// beneath it, and the last stretch of the section is a pause with the finished cover.
// It only runs forward: scrolling back up does not recompose, and coming from below the cover is complete.
function animatedRelease(release) {
  return `
    <article
      class="release release--animated"
      data-spotify-url="${encodeURIComponent(release.spotifyReleaseUrl)}"
      data-header-tone="${release.headerTone || "auto"}">
      <div class="release-sticky">
        <div class="release-cover release-cover--animated" role="img" aria-label="Cover art for ${release.title}">
          <dattilogramma-scroll recipe="${release.animation}" paper="reveal" track=".release" start="4" end="62" reveal="33 62" forward></dattilogramma-scroll>
        </div>

        ${releaseContent(release)}

        ${scrollCue}
      </div>
    </article>`;
}

function releaseContent(release) {
  return `
      <div class="release-content">
        <p class="release-kicker">${release.type} — ${release.year}</p>
        <h2 class="release-title">${release.title}</h2>
        <p class="release-meta">Leonardo Cupelli</p>

        <div class="stream-links">
          ${Object.entries(release.links).map(([service, link]) => `
            <a
              class="stream-link stream-link--${slugify(service)}"
              href="${link.url}"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Listen to ${release.title} on ${service}">
              ${serviceLogo(service)}
              <span>${service}</span>
            </a>
          `).join("")}
        </div>
      </div>`;
}

// The cover gets its source only once (Spotify, or the local file if that fails), so it never
// swaps from one image to another; it fades in when that first image has loaded.
async function loadSpotifyCover(article) {
  const image = article.querySelector(".release-cover");
  const spotifyUrl = article.dataset.spotifyUrl;
  const fallback = article.dataset.fallbackCover;

  image.addEventListener("load", () => image.classList.add("is-loaded"), { once: true });
  image.addEventListener("error", () => {
    if (fallback && image.getAttribute("src") !== fallback) image.src = fallback;
  });

  try {
    const response = await fetch(`https://open.spotify.com/oembed?url=${spotifyUrl}`);
    const data = await response.json();

    if (data.thumbnail_url) {
      image.src = data.thumbnail_url;
      return;
    }
  } catch (error) {
    console.warn("Spotify cover lookup failed:", error);
  }

  if (fallback) image.src = fallback;
}

function updateHeaderContrast(articles) {
  const header = document.getElementById("site-header");
  const headerBottom = 80;
  const active = articles.find(article => {
    const rect = article.getBoundingClientRect();
    return rect.top <= headerBottom && rect.bottom > headerBottom;
  });

  if (!active) {
    header.classList.add("is-dark");
    header.classList.remove("is-light");
    return;
  }

  const tone = active.dataset.headerTone === "auto" ? animatedTone(active) : getCoverTone(active);
  header.classList.toggle("is-light", tone === "light");
  header.classList.toggle("is-dark", tone !== "light");
}

function getCoverTone(article) {
  const image = article.querySelector(".release-cover");

  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    canvas.width = 10;
    canvas.height = 10;
    context.drawImage(image, 0, 0, 10, 10);
    const data = context.getImageData(0, 0, 10, 10).data;

    let total = 0;
    for (let i = 0; i < data.length; i += 4) {
      total += (data[i] * .299 + data[i + 1] * .587 + data[i + 2] * .114);
    }

    return total / (data.length / 4) > 140 ? "light" : "dark";
  } catch (error) {
    return article.dataset.headerTone || "dark";
  }
}

// Header colour over an animated release: dark text on a light page, or once the paper has appeared
function animatedTone(article) {
  const paper = article.querySelector("dattilogramma-scroll")?.reveal || 0;
  return matchMedia("(prefers-color-scheme: light)").matches || paper > .5 ? "light" : "dark";
}

function slugify(value) {
  return value.toLowerCase().replace(/\s+/g, "-");
}

function serviceLogo(service) {
  const logos = {
    "Spotify": `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0zm5.5 17.3c-.2.4-.7.5-1 .3-2.9-1.8-6.5-2.2-10.8-1.2-.4.1-.8-.2-.9-.6-.1-.4.2-.8.6-.9 4.7-1.1 8.7-.6 11.9 1.4.3.2.4.7.2 1zm1.5-3.3c-.3.4-.8.6-1.3.3-3.3-2-8.3-2.6-12.2-1.4-.5.1-1-.1-1.2-.6-.1-.5.1-1 .6-1.2 4.4-1.3 9.9-.7 13.7 1.6.5.3.6.9.4 1.3zm.1-3.4C15.3 8.3 8.9 8.1 5.3 9.2c-.6.2-1.2-.2-1.4-.7-.2-.6.2-1.2.7-1.4 4.2-1.3 11.2-1 15.6 1.6.5.3.7 1 .4 1.5-.3.5-1 .7-1.5.4z"/></svg>`,
    "Bandcamp": `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M0 18.75l7.437-13.5H24l-7.438 13.5H0z"/></svg>`,
    "Apple Music": `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8.94-.19 1.84-.86 3.11-.8 1.53.12 2.69.73 3.44 1.84-3.15 1.89-2.38 6.02.48 7.19-.58 1.31-1.31 2.61-2.11 3.94zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>`,
    "YouTube": `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81zM9.55 15.57V8.43L15.82 12l-6.27 3.57z"/></svg>`
  };

  return logos[service] || "";
}

document.getElementById("year").textContent = new Date().getFullYear();
loadReleases();