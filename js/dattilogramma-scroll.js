/*!
 * Dattilogramma · componente per lo scroll
 *
 * Uso:
 *   <script src="dattilogramma-scroll.js" defer></script>
 *   <dattilogramma-scroll recipe="DTG1:..."></dattilogramma-scroll>
 *
 * Il dattilogramma resta fermo al centro dello schermo mentre la sezione scorre:
 * all'inizio il testo è composto, poi si scompone seguendo lo scroll.
 * Stessa ricetta dell'app, stesso disegno.
 *
 * Attributi
 *   recipe         codice DTG1:… copiato dall'app (consigliato)
 *   text, seed, format, shape, dir, thin, repeat,
 *   over, sparse, noise, ink, cols, rows, lead
 *                  in alternativa alla ricetta, o per sovrascriverne un valore
 *                  (stessi valori dei cursori dell'app: sparse/noise/ink 0–100, lead 80–200)
 *   length         altezza della sezione, cioè quanto scroll serve (predefinito 300vh)
 *   from, to       scomposizione all'inizio e alla fine, 0–100 (predefiniti 0 e 100)
 *   start, end     in che punto dello scroll della sezione (0–100) parte e finisce
 *                  la scomposizione (predefiniti 5 e 80: il resto è pausa)
 *   paper          "on" (predefinito) mostra il foglio; "off" solo segni su fondo trasparente,
 *                  ritagliati attorno al dattilogramma; "reveal" segni su fondo trasparente
 *                  e, finita la scomposizione, il foglio compare sotto di loro
 *   reveal         con paper="reveal": inizio e fine della comparsa del foglio, in percentuale
 *                  dello scroll della sezione (predefinito "82 96")
 *   track          selettore di un contenitore esterno (cercato con closest) che fa da sezione:
 *                  il componente riempie il suo box e lo scroll di quel contenitore guida
 *                  l'animazione. Senza, il componente crea da sé la sezione alta `length`.
 *   ink-color      colore dei segni. Senza foglio, se manca, usa il colore del testo della pagina
 *                  (CSS `color`), quindi segue da solo la modalità chiara/scura del sito
 *   size           altezza massima sullo schermo (predefinito 86vh)
 *   smooth         ammorbidimento del movimento in millisecondi (predefinito 140; 0 = nessuno)
 *   forward        solo in avanti: scrollando verso il basso si scompone, risalendo non si
 *                  ricompone. Si riparte da zero solo dopo essere tornati sopra la sezione;
 *                  arrivando dal basso il dattilogramma è già completo.
 */
(() => {
  if (customElements.get('dattilogramma-scroll')) return;

  // Fonts must be declared at document level to be usable inside the shadow root.
  const FONT_URL = 'https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400&display=swap';
  if (!document.querySelector(`link[href="${FONT_URL}"]`)) {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = FONT_URL;
    document.head.appendChild(l);
  }

  const FORMATS = {
    portrait:  { w: 1200, h: 1640, bw: .56, bh: .78 },
    landscape: { w: 1640, h: 1200, bw: .70, bh: .72 },
    square:    { w: 1400, h: 1400, bw: .66, bh: .66 },
    strip:     { w: 800,  h: 1800, bw: .66, bh: .84 },
  };
  const DIRS = ['left', 'right', 'top', 'bottom', 'center', 'diag'];
  const SHAPES = ['rect', 'circle', 'diamond', 'triangle'];
  const THIN = ['i','i','i','i','j','j','j','l','l','T','T','i'];
  const DEFAULTS = {
    text: "la lettera si consuma battendo, ogni tasto lascia una traccia e poi un'altra sopra, finché la parola non è più parola ma un tessuto di segni",
    format: 'portrait', shape: 'rect', dir: 'left', thin: true, repeat: true, seed: 7,
    over: 3, sparse: 78, noise: 45, ink: 62, cols: 52, rows: 40, lead: 145,
  };
  const MAX_PIXELS = 3.2e6;   // cap on the drawing surface, keeps every frame cheap
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  function decodeRecipe(code) {
    try {
      const r = JSON.parse(decodeURIComponent(escape(atob(code.trim().replace(/^DTG1:/, '')))));
      if (r && r.format === 'circle') { r.format = 'square'; r.shape = r.shape || 'circle'; }
      return r && r.v === 1 ? r : null;
    } catch { return null; }
  }
  const clamp01 = v => Math.min(1, Math.max(0, v));

  class DattilogrammaScroll extends HTMLElement {
    static get observedAttributes() {
      return ['recipe', 'text', 'seed', 'format', 'shape', 'dir', 'thin', 'repeat', 'over', 'sparse',
              'noise', 'ink', 'cols', 'rows', 'lead', 'length', 'from', 'to', 'start', 'end',
              'paper', 'size', 'ink-color', 'smooth', 'track', 'reveal', 'forward'];
    }

    constructor() {
      super();
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML = `
        <style>
          :host { display: block; position: relative; }
          .track { position: relative; }
          .stick { position: sticky; top: 0; height: 100vh; height: 100svh; display: flex; align-items: center; justify-content: center; overflow: hidden; }
          canvas { display: block; height: auto; }
          :host(:not([paper="off"]):not([paper="reveal"])) canvas { box-shadow: 0 1px 2px rgba(30,28,25,.14), 0 18px 40px -18px rgba(30,28,25,.3); }
          :host([track]) { height: 100%; }
          :host([track]) .track, :host([track]) .stick { position: static; height: 100%; }
          :host([track]) canvas { width: 100%; height: 100%; }
        </style>
        <div class="track"><div class="stick"><canvas role="img"></canvas></div></div>`;
      this.track = root.querySelector('.track');
      this.stick = root.querySelector('.stick');
      this.cv = root.querySelector('canvas');
      this.ctx = this.cv.getContext('2d');
      const mk = () => document.createElement('canvas');
      this.paperC = mk(); this.inkC = mk(); this.tmpC = mk(); this.speckC = mk();
      this.cur = null;      // amount on screen
      this.target = 0;      // amount the scroll asks for
      this.drawn = null;    // amount last drawn
      this.atlas = new Map();
      this.k = 1;
      this.onScroll = () => this.schedule();
      this.onResize = () => { this.measureScale(); this.schedule(); };
      // redraw when the page switches between light and dark
      this.onTheme = () => { this.atlas.clear(); this.drawn = null; this.schedule(); };
      this.scheme = matchMedia('(prefers-color-scheme: dark)');
      this.themeObserver = new MutationObserver(this.onTheme);
      this.tick = this.tick.bind(this);
      this.sizes = new ResizeObserver(this.onResize);
    }

    connectedCallback() {
      this.configure();
      addEventListener('scroll', this.onScroll, { passive: true });
      addEventListener('resize', this.onResize);
      visualViewport?.addEventListener('resize', this.onResize);
      this.scheme.addEventListener('change', this.onTheme);
      for (const el of [document.documentElement, document.body])
        this.themeObserver.observe(el, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
      document.fonts.load('40px "Courier Prime"').catch(() => {}).then(() => { this.atlas.clear(); this.drawn = null; this.schedule(); });
      this.sizes.observe(this.cv);
      this.measureScale();
      this.schedule();
    }
    disconnectedCallback() {
      this.sizes.disconnect();
      removeEventListener('scroll', this.onScroll);
      removeEventListener('resize', this.onResize);
      visualViewport?.removeEventListener('resize', this.onResize);
      this.scheme.removeEventListener('change', this.onTheme);
      this.themeObserver.disconnect();
      cancelAnimationFrame(this.frame); this.frame = 0;
    }
    attributeChangedCallback() {
      if (this.isConnected) { this.configure(); this.measureScale(); this.schedule(); }
    }

    // ---------- parameters ----------
    configure() {
      const r = decodeRecipe(this.getAttribute('recipe') || '') || {};
      const a = n => this.getAttribute(n);
      const pick = (n, fallback) => a(n) !== null ? a(n) : (r[n] !== undefined ? r[n] : fallback);
      const num = (n, lo, hi) => Math.min(hi, Math.max(lo, +pick(n, DEFAULTS[n]) || DEFAULTS[n]));
      const bool = n => { const v = pick(n, DEFAULTS[n]); return v === true || v === 'true' || v === '' || v === 'on'; };
      const one = (n, list) => list.includes(pick(n, DEFAULTS[n])) ? pick(n, DEFAULTS[n]) : DEFAULTS[n];
      const pct = (n, d) => { const v = a(n); return v === null || isNaN(+v) ? d : clamp01(+v / 100); };
      const format = pick('format', DEFAULTS.format) in FORMATS ? pick('format', DEFAULTS.format) : DEFAULTS.format;
      this.P = {
        text: String(pick('text', DEFAULTS.text)),
        format, shape: one('shape', SHAPES), dir: one('dir', DIRS),
        thin: bool('thin'), repeat: bool('repeat'),
        seed: Math.round(num('seed', 1, 999999)),
        over: num('over', 0, 6), sparse: num('sparse', 0, 100) / 100, noise: num('noise', 0, 100) / 100,
        ink: num('ink', 0, 100) / 100, cols: Math.round(num('cols', 24, 90)), rows: Math.round(num('rows', 8, 60)),
        lead: num('lead', 80, 200) / 100, amount: 0,
      };
      this.from = pct('from', 0); this.to = pct('to', 1);
      this.start = pct('start', .05); this.end = Math.max(this.start + .01, pct('end', .8));
      this.smooth = Math.max(0, +(a('smooth') ?? 140) || 0);
      this.paperMode = ['off', 'reveal'].includes(a('paper')) ? a('paper') : 'on';
      this.paper = this.paperMode !== 'off';   // the whole sheet is kept, paper may show
      const rv = (a('reveal') || '82 96').split(/[\s,]+/).map(v => clamp01(+v / 100));
      this.revealA = isNaN(rv[0]) ? .82 : rv[0];
      this.revealB = Math.max(this.revealA + .01, isNaN(rv[1]) ? .96 : rv[1]);
      this.rv = 0;
      this.trackSel = a('track');
      this.track.style.height = this.trackSel ? '' : (a('length') || '300vh');
      const size = a('size') || '86vh';
      this.cv.setAttribute('aria-label', this.P.text);

      const F = FORMATS[format];
      this.W = F.w; this.H = F.h;
      this.geometry();
      // crop: the whole sheet with paper, otherwise just the block plus a margin for stray strikes
      if (this.paper) this.crop = { x: 0, y: 0, w: this.W, h: this.H };
      else {
        const g = this.g, m = Math.max(g.BW, g.BH) * .05;
        const x = Math.max(0, Math.floor(g.x0 - m)), y = Math.max(0, Math.floor(g.y0 - m));
        this.crop = { x, y, w: Math.min(this.W, Math.ceil(g.x0 + g.BW + m)) - x, h: Math.min(this.H, Math.ceil(g.y0 + g.BH + m)) - y };
      }
      this.cv.style.aspectRatio = `${this.crop.w} / ${this.crop.h}`;
      // CSS size independent of the bitmap size, so the drawing scale can follow the screen
      this.cv.style.width = this.trackSel ? '' : `min(96%, calc(${size} * ${(this.crop.w / this.crop.h).toFixed(4)}))`;
      this.cv.style.boxShadow = '';
      this.k = 0;           // forces surfaces to be rebuilt at the right scale
      this.drawn = null;
    }

    // drawing scale: match the canvas to the screen's real pixels, within a budget
    measureScale() {
      if (!this.crop) return;
      const cssW = this.cv.getBoundingClientRect().width || this.crop.w;
      const want = cssW * (devicePixelRatio || 1) / this.crop.w;
      const cap = Math.sqrt(MAX_PIXELS / (this.crop.w * this.crop.h));
      const k = Math.max(.5, Math.round(Math.min(want, cap, 2) * 4) / 4);
      if (k === this.k) return;
      this.k = k;
      const cw = Math.round(this.crop.w * k), ch = Math.round(this.crop.h * k);
      for (const c of [this.cv, this.paperC, this.inkC, this.tmpC, this.speckC]) { c.width = cw; c.height = ch; }
      this.atlas.clear();
      if (this.paper) this.makePaper();
      this.makeSpeckle();
      this.drawn = null;
    }

    // ---------- seeded randomness (identical to the app) ----------
    rnd(k, ch) {
      let h = Math.imul(k ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((ch + 1) * 2654435761 + this.P.seed * 7919, 0xc2b2ae35);
      h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
      return (h >>> 0) / 4294967296;
    }
    vnoise(x, y) {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const g = (a, b) => this.rnd(a * 73856093 ^ b * 19349663, 999);
      const s = t => t * t * (3 - 2 * t);
      const a = g(xi, yi), b = g(xi + 1, yi), c = g(xi, yi + 1), d = g(xi + 1, yi + 1);
      const u = s(xf), v = s(yf);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
    field(u, v) {
      const P = this.P;
      let g;
      switch (P.dir) {
        case 'right': g = u; break;
        case 'top': g = 1 - v; break;
        case 'bottom': g = v; break;
        case 'center': g = 1 - Math.min(1, Math.hypot(u - .5, (v - .5) * .8) * 1.9); break;
        case 'diag': g = 1 - (u + v) / 2; break;
        default: g = 1 - u;
      }
      const n = this.vnoise(u * 4.2, v * 7) * .65 + this.vnoise(u * 11, v * 17) * .35;
      g += (n - .5) * P.noise * 1.1;
      g = clamp01(g);
      return g * g * (3 - 2 * g) * .7 + g * .3;
    }
    prep(text) {
      const flat = text.replace(/\s+/g, ' ').trim();
      if (!flat) return null;
      const arr = Array.from(flat);
      if (this.P.repeat) arr.push(' ');
      if (!this.P.thin) return arr;
      return arr.map(c => {
        if (c === ' ') return ' ';
        const code = c.toLowerCase().codePointAt(0);
        return THIN[(code * 7 + (code >> 2)) % THIN.length];
      });
    }

    // ---------- layout (identical to the app) ----------
    geometry() {
      const P = this.P, W = this.W, H = this.H, F = FORMATS[P.format];
      const shaped = P.shape !== 'rect';
      const D = Math.min(W, H) * .78;
      const pitch = shaped
        ? D / (P.rows * P.lead) * .6
        : Math.min(W * F.bw / P.cols, H * F.bh / (P.rows * P.lead) * .6);
      const fs = pitch / .6, lh = fs * P.lead;
      const BW = shaped ? D : pitch * P.cols, BH = P.rows * lh;
      this.g = {
        shaped, pitch, fs, lh, BW, BH,
        x0: (W - BW) / 2 - (shaped ? 0 : W * .015),
        y0: (H - BH) / 2 - (shaped ? 0 : H * .02),
      };
      this.chars = this.prep(P.text);
    }
    build() {
      const P = this.P, H = this.H, rnd = (k, c) => this.rnd(k, c);
      const { shaped, pitch, lh, BW, x0, y0 } = this.g;
      const chars = this.chars;
      const strikes = [];
      if (!chars) return strikes;
      const s = P.amount, len = chars.length;
      let k = 0;
      outer:
      for (let r = 0; r < P.rows; r++) {
        const v = P.rows > 1 ? r / (P.rows - 1) : .5;
        const baseY = y0 + r * lh + lh * .78;
        if (baseY > H - H * .05) break;
        let xs = 0, xe = BW;
        if (shaped) {
          const yc = (r + .5) / P.rows, e = 2 * yc - 1;
          const half = P.shape === 'circle' ? .5 * Math.sqrt(Math.max(0, 1 - e * e))
                     : P.shape === 'diamond' ? .5 * (1 - Math.abs(e))
                     : .5 * yc;
          if (half * BW < pitch) continue;
          xs = BW * (.5 - half); xe = BW * (.5 + half);
        }
        let x = xs;
        while (x <= xe - pitch) {
          if (!P.repeat && k >= len) break outer;
          const ch = chars[k % len];
          const u = x / BW;
          const g = this.field(u, v);
          const advF = 1 + s * ((.2 + .8 * Math.pow(1 - g, 1.5)) - 1);
          if (ch !== ' ') {
            const drop = s * Math.pow(1 - g, .7) * P.sparse;
            if (rnd(k, 1) >= drop) {
              const copies = 1 + Math.floor(rnd(k, 2) * (s * g * P.over + 1));
              for (let c = 0; c < copies; c++) {
                let dx = (rnd(k, 4) - .5) * pitch * .14 * s;
                let dy = (rnd(k, 3) - .5) * lh * .07 * s;
                let glyph = ch;
                if (c > 0) {
                  dx += (rnd(k, 10 + c) - .5) * pitch * 1.1 * s;
                  if (rnd(k, 20 + c) < .4 * s) dy += (rnd(k, 30 + c) < .5 ? -1 : 1) * lh * (.22 + .18 * rnd(k, 35 + c));
                  if (rnd(k, 45 + c) < .5) { const alt = chars[(k + c) % len]; if (alt !== ' ') glyph = alt; }
                }
                let a = .92 + s * ((.28 + .67 * rnd(k, 50 + c)) - .92);
                if (rnd(k, 60 + c) < .15 * s) a = .08 + .16 * rnd(k, 65 + c);
                a *= .45 + .75 * P.ink;
                strikes.push(x0 + x + dx, baseY + dy, Math.min(1, a), (rnd(k, 70 + c) - .5) * .07 * s, glyph);
              }
            }
          }
          x += pitch * advF;
          k++;
        }
      }
      return strikes;
    }

    // ---------- surfaces ----------
    makePaper() {
      const cw = this.paperC.width, ch = this.paperC.height;
      const p = this.paperC.getContext('2d', { willReadFrequently: true });
      p.fillStyle = '#ecebe6'; p.fillRect(0, 0, cw, ch);
      const img = p.getImageData(0, 0, cw, ch), d = img.data;
      let s = (Math.imul(this.P.seed, 2654435761) >>> 1) || 12345;
      for (let i = 0; i < d.length; i += 4) {
        s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff;
        const n = ((s >> 8) & 15) - 7;
        d[i] += n; d[i + 1] += n; d[i + 2] += n + 1;
      }
      p.putImageData(img, 0, 0);
      const gr = p.createRadialGradient(cw / 2, ch / 2, ch * .25, cw / 2, ch / 2, ch * .8);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(120,115,105,.10)');
      p.fillStyle = gr; p.fillRect(0, 0, cw, ch);
    }
    // ribbon wear: the same seeded dots as the app, mapped onto the cropped, scaled surface
    makeSpeckle() {
      const sp = this.speckC.getContext('2d'), k = this.k, c = this.crop, W = this.W, H = this.H;
      sp.setTransform(1, 0, 0, 1, 0, 0);
      sp.clearRect(0, 0, this.speckC.width, this.speckC.height);
      let s = 987 + (this.P.seed * 7919) % 2147483000;
      const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 90000; i++) {
        const alpha = .15 + r() * .6, rr = .4 + r() * 1.1, x = r() * W, y = r() * H;
        if (x < c.x - 2 || y < c.y - 2 || x > c.x + c.w || y > c.y + c.h) continue;
        sp.fillStyle = `rgba(0,0,0,${alpha.toFixed(2)})`;
        sp.fillRect((x - c.x) * k, (y - c.y) * k, rr * k, rr * k);
      }
    }
    inkColor() {
      const fixed = this.getAttribute('ink-color');
      if (fixed) return fixed;
      if (this.paperMode === 'on') return '#1c1b20';
      const base = getComputedStyle(this).color;
      if (this.paperMode !== 'reveal' || !this.rv) return base;
      // as the paper appears, the page-coloured marks turn into typewriter ink
      const m = base.match(/[\d.]+/g);
      if (!m) return '#1c1b20';
      const t = this.rv, mix = (a, b) => Math.round(+a + (b - a) * t);
      return `rgb(${mix(m[0], 28)},${mix(m[1], 27)},${mix(m[2], 32)})`;
    }
    // every glyph is rasterised once; frames then only stamp images, far cheaper than fillText
    sprite(ch) {
      let s = this.atlas.get(ch);
      if (s) return s;
      // tight box around one monospace cell: ascender + descender + a little room for the ink bleed
      const k = this.k, fs = this.g.fs, pad = fs * .07, asc = fs * .82, desc = fs * .3;
      const w = fs * .62 + pad * 2, h = asc + desc + pad * 2;
      const c = document.createElement('canvas');
      c.width = Math.ceil(w * k); c.height = Math.ceil(h * k);
      const x = c.getContext('2d');
      x.setTransform(k, 0, 0, k, 0, 0);
      x.font = `${fs.toFixed(2)}px "Courier Prime", "Courier New", monospace`;
      x.fillStyle = this.color;
      x.textBaseline = 'alphabetic';
      // the ink bleed (a faint copy nudged right and down) is baked into the sprite: one stamp per strike
      x.globalAlpha = .3; x.fillText(ch, pad + .7, pad + asc + .4);
      x.globalAlpha = 1; x.fillText(ch, pad, pad + asc);
      s = { img: c, ox: pad, oy: pad + asc, w: c.width / k, h: c.height / k };
      this.atlas.set(ch, s);
      return s;
    }
    render() {
      const k = this.k, c = this.crop, cw = this.cv.width, chh = this.cv.height;
      const color = this.inkColor();
      if (color !== this.color) { this.color = color; this.atlas.clear(); }
      const st = this.build();
      const ic = this.inkC.getContext('2d');
      ic.setTransform(1, 0, 0, 1, 0, 0);
      ic.globalAlpha = 1;
      ic.clearRect(0, 0, cw, chh);
      for (let i = 0; i < st.length; i += 5) {
        const sp = this.sprite(st[i + 4]), rot = st[i + 3];
        const cos = Math.cos(rot) * k, sin = Math.sin(rot) * k;
        ic.setTransform(cos, sin, -sin, cos, (st[i] - c.x) * k, (st[i + 1] - c.y) * k);
        ic.globalAlpha = st[i + 2];
        ic.drawImage(sp.img, -sp.ox, -sp.oy, sp.w, sp.h);
      }
      ic.setTransform(1, 0, 0, 1, 0, 0);
      ic.globalAlpha = 1;

      const tc = this.tmpC.getContext('2d');
      tc.globalCompositeOperation = 'source-over';
      tc.clearRect(0, 0, cw, chh);
      tc.drawImage(this.inkC, 0, 0);
      tc.globalCompositeOperation = 'destination-out';
      tc.globalAlpha = .55 + (1 - this.P.ink) * .4;
      tc.drawImage(this.speckC, 0, 0);
      tc.globalAlpha = 1;
      tc.globalCompositeOperation = 'source-over';

      const ctx = this.ctx;
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, cw, chh);
      if (this.paperMode === 'on') {
        ctx.drawImage(this.paperC, 0, 0);
        ctx.globalCompositeOperation = 'multiply';
      } else if (this.paperMode === 'reveal' && this.rv > 0) {
        ctx.globalAlpha = this.rv;
        ctx.drawImage(this.paperC, 0, 0);
        ctx.globalAlpha = 1;
      }
      ctx.drawImage(this.tmpC, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      if (this.paperMode === 'reveal' && this.shadowRv !== this.rv) {
        const r = this.rv;
        this.cv.style.boxShadow = r ? `0 1px 2px rgba(30,28,25,${(.14 * r).toFixed(3)}), 0 18px 40px -18px rgba(30,28,25,${(.3 * r).toFixed(3)})` : '';
        this.shadowRv = r;
      }
    }

    // ---------- scroll ----------
    progress() {
      const host = this.trackSel ? this.closest(this.trackSel) : null;
      const r = (host || this.track).getBoundingClientRect();
      const travel = r.height - (host ? innerHeight : this.stick.offsetHeight);
      const p = travel <= 0 ? (r.top <= 0 ? 1 : 0) : clamp01(-r.top / travel);
      if (!this.hasAttribute('forward')) return p;
      // forward only: keep the furthest point reached; start over once the section is
      // entirely below the screen again, i.e. the reader has gone back above it
      if (r.top >= innerHeight || this.reached === undefined) this.reached = p;
      else this.reached = Math.max(this.reached, p);
      return this.reached;
    }
    schedule() {
      if (!this.frame) { this.last = performance.now(); this.frame = requestAnimationFrame(this.tick); }
    }
    tick(now) {
      this.frame = 0;
      if (!this.k) this.measureScale();
      // cur follows the scroll progress of the section with frame-rate independent easing
      this.target = this.progress();
      if (this.cur === null || !this.smooth || reduceMotion.matches) this.cur = this.target;
      else {
        const dt = Math.min(64, now - (this.last || now));
        this.cur += (this.target - this.cur) * (1 - Math.exp(-dt / this.smooth));
        if (Math.abs(this.target - this.cur) < .0005) this.cur = this.target;
      }
      this.last = now;
      if (this.drawn === null || Math.abs(this.cur - this.drawn) > .0003) {
        const smooth = t => t * t * (3 - 2 * t);
        this.P.amount = this.from + (this.to - this.from) * smooth(clamp01((this.cur - this.start) / (this.end - this.start)));
        this.rv = this.paperMode === 'reveal'
          ? Math.round(smooth(clamp01((this.cur - this.revealA) / (this.revealB - this.revealA))) * 48) / 48 : 0;
        this.render();
        this.drawn = this.cur;
      }
      if (this.cur !== this.target) { this.frame = requestAnimationFrame(this.tick); }
    }

    // amount currently on screen, 0–1 (read-only, handy for debugging)
    get amount() { return this.P ? this.P.amount : 0; }
    // how much of the paper is showing with paper="reveal", 0–1
    get reveal() { return this.rv || 0; }
  }

  customElements.define('dattilogramma-scroll', DattilogrammaScroll);
})();
