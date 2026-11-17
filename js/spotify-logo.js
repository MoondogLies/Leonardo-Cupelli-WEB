(() => {
  const style = document.createElement('style');
  style.textContent = '.stream-link .spotify-logo { width:20px; height:20px; flex:none; object-fit:contain; } @media(max-width:860px) { .stream-link .spotify-logo { width:16px; height:16px; } }';
  document.head.append(style);
  const container = document.getElementById('release-list');
  function replace() {
    container.querySelectorAll('.stream-link--spotify svg').forEach(svg => {
      const image = document.createElement('img');
      image.className = 'spotify-logo';
      image.src = 'assets/spotify.svg';
      image.alt = '';
      image.setAttribute('aria-hidden', 'true');
      image.width = 20;
      image.height = 20;
      svg.replaceWith(image);
    });
  }
  new MutationObserver(replace).observe(container, { childList:true, subtree:true });
  replace();
})();
