async function loadReleases() {
  const container = document.getElementById("release-list");
  const response = await fetch("data/releases.json");
  const releases = await response.json();

  container.innerHTML = releases.map((release, index) => `
    <article class="release" data-release="${index}">
      <img class="release-cover" src="${release.cover}" alt="Cover art for ${release.title}">

      <div class="release-content">
        <p class="release-kicker">${release.type} — ${release.year}</p>
        <h2 class="release-title">${release.title}</h2>
        <p class="release-meta">Leonardo Cupelli</p>

        <div class="stream-tabs" role="tablist" aria-label="Streaming services">
          ${Object.entries(release.embeds).map(([service, embed], i) => `
            <button
              class="stream-tab${i === 0 ? " is-active" : ""}"
              type="button"
              role="tab"
              aria-selected="${i === 0}"
              data-service="${service}"
              data-url="${embed.url}"
              data-height="${embed.height}">
              ${service}
            </button>
          `).join("")}
        </div>

        <div class="player-frame" data-player></div>
      </div>
    </article>
  `).join("");

  container.querySelectorAll(".release").forEach(initRelease);
}

function initRelease(article) {
  const tabs = article.querySelectorAll(".stream-tab");
  const player = article.querySelector("[data-player]");

  function selectTab(tab) {
    tabs.forEach(item => {
      item.classList.toggle("is-active", item === tab);
      item.setAttribute("aria-selected", String(item === tab));
    });

    player.innerHTML = `<iframe
      src="${tab.dataset.url}"
      title="${tab.dataset.service} player"
      height="${tab.dataset.height}"
      loading="lazy"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      allowfullscreen></iframe>`;
  }

  tabs.forEach(tab => tab.addEventListener("click", () => selectTab(tab)));
  selectTab(tabs[0]);
}

document.getElementById("year").textContent = new Date().getFullYear();
loadReleases();