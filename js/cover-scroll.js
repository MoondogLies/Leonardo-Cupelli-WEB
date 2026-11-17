(() => {
  document.querySelector('.viewport-fade')?.remove();
  const style = document.createElement('style');
  style.textContent = '.release { background: var(--bg); } .release-cover { filter: blur(var(--cover-blur, 0px)); opacity: var(--cover-opacity, 1); }';
  document.head.append(style);
  const container = document.getElementById('release-list');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let pending = false;
  function update() {
    pending = false;
    const height = window.visualViewport?.height || window.innerHeight;
    container.querySelectorAll('.release-cover').forEach(image => {
      const rect = image.getBoundingClientRect();
      const band = Math.min(height * 0.22, rect.height * 0.5);
      if (band <= 0) return;
      const entering = Math.max(0, Math.min(1, (rect.top - (height - band)) / band));
      const exiting = Math.max(0, Math.min(1, -rect.top / Math.max(1, rect.height)));
      const amount = reducedMotion.matches ? 0 : Math.max(entering, exiting);
      image.style.setProperty('--cover-blur', `${(amount * 16).toFixed(2)}px`);
      image.style.setProperty('--cover-opacity', (1 - amount).toFixed(3));
    });
  }
  function schedule() {
    if (!pending) { pending = true; requestAnimationFrame(update); }
  }
  new MutationObserver(schedule).observe(container, { childList: true, subtree: true });
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('scroll', schedule);
  container.addEventListener('load', schedule, true);
  reducedMotion.addEventListener('change', schedule);
  schedule();
})();
