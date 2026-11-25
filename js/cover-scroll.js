(() => {
  document.querySelector('.viewport-fade')?.remove();
  const cache = new WeakMap();
  const originalTone = window.getCoverTone;
  if (typeof originalTone === 'function') {
    window.getCoverTone = article => {
      const image = article.querySelector('.release-cover');
      if (!image?.complete || !image.naturalWidth) return article.dataset.headerTone || 'dark';
      const saved = cache.get(image);
      if (saved?.src === image.currentSrc) return saved.tone;
      const tone = originalTone(article);
      cache.set(image, { src: image.currentSrc, tone });
      return tone;
    };
  }
  const originalHeader = window.updateHeaderContrast;
  let headerFrame = 0;
  if (typeof originalHeader === 'function') {
    window.updateHeaderContrast = articles => {
      if (!headerFrame) headerFrame = requestAnimationFrame(() => {
        headerFrame = 0;
        originalHeader(articles);
      });
    };
  }
  const style = document.createElement('style');
  style.textContent = `.release { position:relative; } .release-cover { filter:none!important; opacity:1!important; } .cover-blur-copy { position:absolute; pointer-events:none; z-index:1; overflow:hidden; mask-image:var(--edge-mask); -webkit-mask-image:var(--edge-mask); } .cover-blur-copy img { display:block; width:100%; height:100%; object-fit:cover; filter:blur(8px); transform:scale(1.035); } .scroll-cue { z-index:2; } .release-cover { --motion-blur:0px; filter:blur(var(--motion-blur))!important; transition:filter .12s linear; will-change:filter; } @media(prefers-reduced-motion:reduce) { .cover-blur-copy { display:none; } .release-cover { --motion-blur:0px; filter:none!important; transition:none; will-change:auto; } }`;
  document.head.append(style);
  const container = document.getElementById('release-list');
  const states = new Map();
  let frame = 0;
  let lastY = window.scrollY;
  let lastTime = performance.now();
  let velocity = 0;
  let idleTimer = 0;
  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }
  function setVelocity(next) {
    const now = performance.now();
    const delta = Math.max(1, now - lastTime);
    const raw = (next - lastY) / delta * 16.667;
    lastY = next;
    lastTime = now;
    velocity = velocity * .8 + raw * .2;
    const strength = Math.min(1, Math.abs(velocity) / 80);
    document.documentElement.style.setProperty('--scroll-motion-blur', `${(strength * 2.2).toFixed(2)}px`);
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      velocity = 0;
      document.documentElement.style.setProperty('--scroll-motion-blur', '0px');
    }, 90);
    schedule();
  }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const state = states.get(entry.target);
      if (state) state.visible = entry.isIntersecting;
    });
    schedule();
  }, { rootMargin:'80px' });
  function register() {
    container.querySelectorAll('img.release-cover').forEach(image => {
      if (states.has(image)) return;
      const overlay = document.createElement('div');
      overlay.className = 'cover-blur-copy';
      overlay.setAttribute('aria-hidden','true');
      const copy = document.createElement('img');
      copy.alt = '';
      copy.decoding = 'async';
      overlay.append(copy);
      image.closest('.release').append(overlay);
      states.set(image, { overlay, copy, visible:true, geometry:'', mask:'' });
      observer.observe(image);
    });
    for (const [image,state] of states) {
      if (!image.isConnected) {
        observer.unobserve(image);
        state.overlay.remove();
        states.delete(image);
      }
    }
    schedule();
  }
  function update() {
    frame = 0;
    const viewport = window.visualViewport;
    const height = viewport?.height || innerHeight;
    const top = viewport?.offsetTop || 0;
    const band = Math.min(200,height*.24);
    const measurements = [];
    for (const [image,state] of states) {
      if (!state.visible) continue;
      const rect = image.getBoundingClientRect();
      const article = image.closest('.release');
      measurements.push({ image,state,rect,parent:article.getBoundingClientRect(),border:article.clientTop });
    }
    measurements.forEach(({ image,state,rect,parent,border }) => {
      const src = image.currentSrc || image.src;
      if (state.copy.getAttribute('src') !== src) state.copy.src = src;
      const geometry = `${rect.left-parent.left}|${rect.top-parent.top-border}|${rect.width}|${rect.height}`;
      if (geometry !== state.geometry) {
        const values = geometry.split('|');
        ['left','top','width','height'].forEach((key,i) => state.overlay.style[key] = `${values[i]}px`);
        state.geometry = geometry;
      }
      const upper = Math.round(top-rect.top);
      const lower = Math.round(top+height-rect.top);
      const mask = `linear-gradient(to bottom,#000 ${upper}px,transparent ${upper+band}px),linear-gradient(to bottom,transparent ${lower-band}px,#000 ${lower}px)`;
      if (mask !== state.mask) {
        state.overlay.style.setProperty('--edge-mask',mask);
        state.mask = mask;
      }
    });
  }
  new MutationObserver(register).observe(container,{ childList:true,subtree:true });
  window.addEventListener('scroll',() => {
    setVelocity(window.scrollY);
  },{ passive:true });
  window.addEventListener('resize',schedule);
  window.visualViewport?.addEventListener('resize',schedule);
  window.visualViewport?.addEventListener('scroll',() => {
    setVelocity(window.scrollY);
  });
  container.addEventListener('load',event => {
    if (!event.target.matches('img.release-cover')) return;
    schedule();
    window.updateHeaderContrast?.([...container.querySelectorAll('.release')]);
  },true);
  register();
})();

(() => {
  const header = document.getElementById('site-header');
  const nav = header?.querySelector('.site-nav');
  const contacts = nav?.querySelector('a[href="#contact"]');
  const discography = nav?.querySelector('a[href="releases.html"]');
  const section = document.getElementById('contact');
  if (!nav || !contacts || !discography || !section) return;
  contacts.classList.add('nav-contacts');
  discography.classList.add('nav-discography');
  const style = document.createElement('style');
  style.textContent = `.site-nav .nav-contacts { opacity:1; visibility:visible; transition:opacity .2s ease,visibility 0s; } .site-nav .nav-discography { translate:0 0; transition:translate .45s cubic-bezier(.22,.61,.36,1),transform .3s cubic-bezier(.22,.61,.36,1); } .site-nav.at-contact-bottom .nav-contacts { opacity:0; visibility:hidden; pointer-events:none; transition:opacity .2s ease,visibility 0s linear .2s; } .site-nav.at-contact-bottom .nav-discography { translate:var(--contact-nav-shift,0px) 0; } @media(prefers-reduced-motion:reduce) { .site-nav .nav-contacts,.site-nav .nav-discography { transition:none!important; } }`;
  document.head.append(style);
  let frame = 0;
  let collapsed = false;
  function update() {
    frame = 0;
    const gap = parseFloat(getComputedStyle(nav).columnGap) || 0;
    nav.style.setProperty('--contact-nav-shift', `${contacts.offsetWidth + gap}px`);
    const remaining = document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
    const atSection = section.getBoundingClientRect().top <= header.getBoundingClientRect().bottom + 1;
    const next = atSection && remaining <= (collapsed ? 28 : 6);
    if (next === collapsed) return;
    collapsed = next;
    if (collapsed && document.activeElement === contacts) discography.focus({ preventScroll:true });
    contacts.toggleAttribute('inert', collapsed);
    contacts.setAttribute('aria-hidden', String(collapsed));
    contacts.tabIndex = collapsed ? -1 : 0;
    nav.classList.toggle('at-contact-bottom', collapsed);
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }
  window.addEventListener('scroll', schedule, { passive:true });
  window.addEventListener('resize', schedule);
  window.addEventListener('pageshow', schedule);
  window.addEventListener('hashchange', schedule);
  document.addEventListener('scrollend', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('scroll', schedule);
  const sizes = new ResizeObserver(schedule);
  sizes.observe(document.body);
  sizes.observe(nav);
  document.fonts.ready.then(schedule);
  schedule();
})();
