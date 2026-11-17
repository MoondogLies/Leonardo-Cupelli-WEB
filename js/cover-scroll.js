(() => {
  document.querySelector('.viewport-fade')?.remove();
  const style = document.createElement('style');
  style.textContent = '.release-cover { filter: blur(var(--cover-blur, 0px)); opacity: 1; } .release-cover.is-blur-active { will-change: filter; }';
  document.head.append(style);
  const container = document.getElementById('release-list');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const states = new Map();
  let frame = 0;
  let dirty = true;
  let previousTime = 0;
  function schedule() {
    dirty = true;
    if (!frame) frame = requestAnimationFrame(tick);
  }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const state = states.get(entry.target);
      if (state) {
        state.visible = entry.isIntersecting;
        entry.target.classList.toggle('is-blur-active', entry.isIntersecting && !reducedMotion.matches);
      }
    });
    schedule();
  }, { rootMargin: '40px' });
  function register() {
    container.querySelectorAll('.release-cover').forEach(image => {
      if (states.has(image)) return;
      states.set(image, { visible: true, current: 0, target: 0, written: -1 });
      observer.observe(image);
    });
    for (const [image] of states) {
      if (!image.isConnected) { observer.unobserve(image); states.delete(image); }
    }
    schedule();
  }
  function tick(time) {
    frame = 0;
    const dt = previousTime ? Math.min(50, time - previousTime) : 16.67;
    previousTime = time;
    const alpha = 1 - Math.exp(-dt / 65);
    if (dirty) {
      dirty = false;
      const height = window.visualViewport?.height || window.innerHeight;
      const offset = window.visualViewport?.offsetTop || 0;
      for (const [image, state] of states) {
        if (!state.visible && !reducedMotion.matches) continue;
        image.classList.toggle('is-blur-active', state.visible && !reducedMotion.matches);
        const rect = image.getBoundingClientRect();
        const top = rect.top - offset;
        const band = Math.min(height * 0.22, rect.height * 0.5);
        if (band <= 0) continue;
        const entering = Math.max(0, Math.min(1, (top - (height - band)) / band));
        const exiting = Math.max(0, Math.min(1, -top / Math.max(1, rect.height)));
        state.target = reducedMotion.matches ? 0 : Math.max(entering, exiting) * 12;
      }
    }
    let moving = false;
    for (const [image, state] of states) {
      if (!state.visible && !reducedMotion.matches) continue;
      state.current = reducedMotion.matches ? 0 : state.current + (state.target - state.current) * alpha;
      if (Math.abs(state.target - state.current) < 0.04) state.current = state.target;
      else moving = true;
      const value = Math.round(state.current * 20) / 20;
      if (value !== state.written) {
        image.style.setProperty('--cover-blur', `${value}px`);
        image.style.removeProperty('--cover-opacity');
        state.written = value;
      }
    }
    if (moving) frame = requestAnimationFrame(tick);
    else previousTime = 0;
  }
  new MutationObserver(register).observe(container, { childList: true, subtree: true });
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('scroll', schedule);
  container.addEventListener('load', schedule, true);
  reducedMotion.addEventListener('change', schedule);
  register();
})();
