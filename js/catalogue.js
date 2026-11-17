(() => {
  function releaseId(release, index) {
    const match = (release.spotifyReleaseUrl || '').match(/\/(?:album|track)\/([a-zA-Z0-9]+)/);
    return `release-${release.id || match?.[1] || index + 1}`;
  }
  const home = document.getElementById('release-list');
  if (home) {
    let restored = false;
    function attachIds() {
      home.querySelectorAll('.release').forEach((article, index) => {
        const url = decodeURIComponent(article.dataset.spotifyUrl || '');
        article.id = releaseId({ spotifyReleaseUrl:url }, index);
      });
      if (!restored && location.hash.startsWith('#release-')) {
        const target = document.getElementById(location.hash.slice(1));
        if (target) {
          restored = true;
          requestAnimationFrame(() => target.scrollIntoView({ block:'start', behavior:'instant' }));
        }
      }
    }
    new MutationObserver(attachIds).observe(home,{ childList:true });
    attachIds();
    return;
  }
  const list = document.getElementById('release-index');
  if (!list) return;
  const status = document.getElementById('archive-status');
  function textElement(tag, className, text) {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = text;
    return element;
  }
  async function render() {
    try {
      const response = await fetch('data/releases.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const releases = await response.json();
      if (!Array.isArray(releases)) throw new Error('Formato release non valido');
      const fragment = document.createDocumentFragment();
      releases.forEach((release,index) => {
        const item = document.createElement('li');
        item.className = 'archive-entry';
        const link = document.createElement('a');
        link.className = 'archive-release-link';
        link.href = `index.html#${releaseId(release,index)}`;
        link.append(textElement('span','archive-release-meta',`${release.year || ''} — ${release.type || ''}`));
        link.append(textElement('span','archive-release-title',release.title));
        item.append(link);
        if (/^(album|ep)$/i.test(release.type || '') && Array.isArray(release.tracks) && release.tracks.length) {
          const tracks = document.createElement('ol');
          tracks.className = 'archive-tracks';
          tracks.setAttribute('aria-label',`Brani di ${release.title}`);
          release.tracks.forEach(track => {
            const row = document.createElement('li');
            row.textContent = typeof track === 'string' ? track : track.title;
            tracks.append(row);
          });
          item.append(tracks);
        }
        fragment.append(item);
      });
      list.replaceChildren(fragment);
      status.textContent = releases.length ? '' : 'Nessuna release disponibile.';
      status.hidden = releases.length > 0;
    } catch (error) {
      status.textContent = 'Impossibile caricare le release. Ricarica la pagina per riprovare.';
      console.error('Release archive:',error);
    }
  }
  render();
})();
