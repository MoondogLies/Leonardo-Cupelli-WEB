(() => {
  document.querySelector('.viewport-fade')?.remove();
  const style = document.createElement('style');
  style.textContent = `
    .release { position: relative; }
    .release-cover { filter: none !important; opacity: 1 !important; }
    .cover-edge-blur { position: absolute; pointer-events: none; z-index: 1; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); mask-image: var(--edge-mask); -webkit-mask-image: var(--edge-mask); }
    .scroll-cue { z-index: 2; }
    @media (prefers-reduced-motion: reduce) { .cover-edge-blur { display: none; } }
  `;
  document.head.append(style);
  const container = document.getElementById('release-list');
  const states = new Map();
  let frame = 0;
  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const state = states.get(entry.target);
      if (state) state.visible = entry.isIntersecting;
    });
    schedule();
  }, { rootMargin: '80px' });
  function register() {
    container.querySelectorAll('.release-cover').forEach(image => {
      if (states.has(image)) return;
      const overlay = document.createElement('div');
      overlay.className = 'cover-edge-blur';
      overlay.setAttribute('aria-hidden', 'true');
      image.closest('.release').append(overlay);
      states.set(image, { overlay, visible: true });
      observer.observe(image);
    });
    for (const [image, state] of states) {
      if (!image.isConnected) { observer.unobserve(image); state.overlay.remove(); states.delete(image); }
    }
    schedule();
  }
  function update() {
    frame = 0;
    const viewport = window.visualViewport;
    const height = viewport?.height || window.innerHeight;
    const top = viewport?.offsetTop || 0;
    const band = Math.min(160, height * 0.18);
    const measurements = [];
    for (const [image, state] of states) {
      if (!state.visible) continue;
      const rect = image.getBoundingClientRect();
      const parent = image.closest('.release').getBoundingClientRect();
      measurements.push({ state, rect, parent });
    }
    measurements.forEach(({ state, rect, parent }) => {
      const overlay = state.overlay;
      overlay.style.left = `${rect.left - parent.left}px`;
      overlay.style.top = `${rect.top - parent.top - 1}px`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
      const upper = top - rect.top;
      const lower = top + height - rect.top;
      overlay.style.setProperty('--edge-mask', `linear-gradient(to bottom, #000 ${upper}px, transparent ${upper + band}px), linear-gradient(to bottom, transparent ${lower - band}px, #000 ${lower}px)`);
    });
  }
  new MutationObserver(register).observe(container, { childList: true, subtree: true });
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('scroll', schedule);
  container.addEventListener('load', schedule, true);
  register();
})();
