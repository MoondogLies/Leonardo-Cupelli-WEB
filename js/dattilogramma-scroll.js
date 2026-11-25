/*!
 * Dattilogramma · componente per lo scroll
 *
 * Uso:
 *   <script src="dattilogramma-scroll.js" defer></script>
 *   <dattilogramma-scroll recipe="DTG1:..."></dattilogramma-scroll>
 *
 * Il foglio resta fermo al centro dello schermo mentre la sezione scorre:
 * all'inizio il testo è composto, alla fine è scomposto.
 * Con la stessa ricetta (copiata dall'app) il risultato è identico a quello dell'app.
 *
 * Attributi
 *   recipe         codice DTG1:… copiato dall'app (consigliato)
 *   text, seed, format, shape, dir, thin, repeat,
 *   over, sparse, noise, ink, cols, rows, lead
 *                  in alternativa alla ricetta, o per sovrascriverne un valore
 *                  (stessi valori dei cursori dell'app: sparse/noise/ink 0–100, lead 80–200)
 *   length         altezza della sezione, cioè quanto scroll serve (predefinito 300vh)
 *   from, to       scomposizione all'inizio e alla fine dello scroll, 0–100 (predefiniti 0 e 100)
 *   paper          "on" (predefinito) mostra il foglio; "off" solo segni su fondo trasparente
 *   ink-color      colore dei segni. Senza foglio, se manca, usa il colore del testo della pagina
 *                  (CSS `color`), quindi segue da solo la modalità chiara/scura del sito
 *   size           altezza massima del foglio sullo schermo (predefinito 86vh)
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

  function decodeRecipe(code) {
    try {
      const r = JSON.parse(decodeURIComponent(escape(atob(code.trim().replace(/^DTG1:/, '')))));
      if (r && r.format === 'circle') { r.format = 'square'; r.shape = r.shape || 'circle'; }
      return r && r.v === 1 ? r : null;
    } catch { return null; }
  }

  class DattilogrammaScroll extends HTMLElement {
    static get observedAttributes() {
      return ['recipe', 'text', 'seed', 'format', 'shape', 'dir', 'thin', 'repeat', 'over', 'sparse',
              'noise', 'ink', 'cols', 'rows', 'lead', 'length', 'from', 'to', 'paper', 'size', 'ink-color'];
    }

    constructor() {
      super();
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML = `
        <style>
          :host { display: block; position: relative; }
          .track { position: relative; }
          .stick { position: sticky; top: 0; height: 100vh; display: flex; align-items: center; justify-content: center; }
          canvas { display: block; max-width: 92%; height: auto; }
          :host([paper="on"]) canvas, :host(:not([paper])) canvas { box-shadow: 0 1px 2px rgba(30,28,25,.14), 0 18px 40px -18px rgba(30,28,25,.3); }
        </style>
        <div class="track"><div class="stick"><canvas role="img"></canvas></div></div>`;
      this.track = root.querySelector('.track');
      this.cv = root.querySelector('canvas');
      this.ctx = this.cv.getContext('2d');
      const mk = () => document.createElement('canvas');
      this.paperC = mk(); this.inkC = mk(); this.tmpC = mk(); this.speckC = mk();
      this.amount = -1;
      this.dirty = true;
      this.onScroll = () => this.schedule();
      // redraw when the page switches between light and dark
      this.onTheme = () => { this.dirty = true; this.schedule(); };
      this.scheme = matchMedia('(prefers-color-scheme: dark)');
      this.themeObserver = new MutationObserver(this.onTheme);
    }

    connectedCallback() {
      this.configure();
      addEventListener('scroll', this.onScroll, { passive: true });
      addEventListener('resize', this.onScroll);
      this.scheme.addEventListener('change', this.onTheme);
      for (const el of [document.documentElement, document.body])
        this.themeObserver.observe(el, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
      document.fonts.load('40px "Courier Prime"').catch(() => {}).then(() => { this.dirty = true; this.schedule(); });
      this.schedule();
    }
    disconnectedCallback() {
      removeEventListener('scroll', this.onScroll);
      removeEventListener('resize', this.onScroll);
      this.scheme.removeEventListener('change', this.onTheme);
      this.themeObserver.disconnect();
    }
    attributeChangedCallback() {
      if (this.isConnected) { this.configure(); this.schedule(); }
    }

    // ---------- parameters ----------
    configure() {
      const r = decodeRecipe(this.getAttribute('recipe') || '') || {};
      const a = n => this.getAttribute(n);
      const pick = (n, fallback) => a(n) !== null ? a(n) : (r[n] !== undefined ? r[n] : fallback);
      const num = (n, lo, hi) => Math.min(hi, Math.max(lo, +pick(n, DEFAULTS[n]) || DEFAULTS[n]));
      const bool = n => { const v = pick(n, DEFAULTS[n]); return v === true || v === 'true' || v === '' || v === 'on'; };
      const one = (n, list) => list.includes(pick(n, DEFAULTS[n])) ? pick(n, DEFAULTS[n]) : DEFAULTS[n];
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
      this.from = Math.min(100, Math.max(0, +(a('from') ?? 0))) / 100;
      this.to = Math.min(100, Math.max(0, +(a('to') ?? 100))) / 100;
      this.paper = (a('paper') || 'on') !== 'off';
      this.track.style.height = a('length') || '300vh';
      this.cv.style.maxHeight = a('size') || '86vh';
      this.cv.setAttribute('aria-label', this.P.text);

      const F = FORMATS[format];
      this.W = F.w; this.H = F.h;
      for (const c of [this.cv, this.paperC, this.inkC, this.tmpC, this.speckC]) { c.width = this.W; c.height = this.H; }
      this.cv.style.aspectRatio = `${this.W} / ${this.H}`;
      this.makePaper(); this.makeSpeckle();
      this.amount = -1; this.dirty = true;
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
      g = Math.min(1, Math.max(0, g));
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
    build() {
      const P = this.P, W = this.W, H = this.H, rnd = (k, c) => this.rnd(k, c);
      const chars = this.prep(P.text);
      const strikes = [];
      const F = FORMATS[P.format];
      const shaped = P.shape !== 'rect';
      const D = Math.min(W, H) * .78;
      const pitch = shaped
        ? D / (P.rows * P.lead) * .6
        : Math.min(W * F.bw / P.cols, H * F.bh / (P.rows * P.lead) * .6);
      const fs = pitch / .6;
      const lh = fs * P.lead;
      const BW = shaped ? D : pitch * P.cols;
      const BH = P.rows * lh;
      const x0 = (W - BW) / 2 - (shaped ? 0 : W * .015);
      const y0 = (H - BH) / 2 - (shaped ? 0 : H * .02);
      this.fs = fs;
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
                strikes.push({ x: x0 + x + dx, y: baseY + dy, ch: glyph, a: Math.min(1, a), rot: (rnd(k, 70 + c) - .5) * .07 * s });
              }
            }
          }
          x += pitch * advF;
          k++;
        }
      }
      return strikes;
    }

    // ---------- surfaces (identical to the app) ----------
    makePaper() {
      const W = this.W, H = this.H, p = this.paperC.getContext('2d', { willReadFrequently: true });
      p.fillStyle = '#ecebe6'; p.fillRect(0, 0, W, H);
      const img = p.getImageData(0, 0, W, H), d = img.data;
      let s = (Math.imul(this.P.seed, 2654435761) >>> 1) || 12345;
      for (let i = 0; i < d.length; i += 4) {
        s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff;
        const n = ((s >> 8) & 15) - 7;
        d[i] += n; d[i + 1] += n; d[i + 2] += n + 1;
      }
      p.putImageData(img, 0, 0);
      const gr = p.createRadialGradient(W / 2, H / 2, H * .25, W / 2, H / 2, H * .8);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(120,115,105,.10)');
      p.fillStyle = gr; p.fillRect(0, 0, W, H);
    }
    makeSpeckle() {
      const W = this.W, H = this.H, sp = this.speckC.getContext('2d');
      sp.clearRect(0, 0, W, H);
      let s = 987 + (this.P.seed * 7919) % 2147483000;
      const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 90000; i++) {
        sp.fillStyle = `rgba(0,0,0,${(.15 + r() * .6).toFixed(2)})`;
        const rr = .4 + r() * 1.1;
        sp.fillRect(r() * W, r() * H, rr, rr);
      }
    }
    render() {
      const W = this.W, H = this.H, P = this.P;
      const strikes = this.build();
      const ic = this.inkC.getContext('2d');
      ic.clearRect(0, 0, W, H);
      ic.font = `${this.fs.toFixed(2)}px "Courier Prime", "Courier New", monospace`;
      ic.fillStyle = this.getAttribute('ink-color') || (this.paper ? '#1c1b20' : getComputedStyle(this).color);
      ic.textBaseline = 'alphabetic';
      for (const st of strikes) {
        ic.save();
        ic.translate(st.x, st.y);
        if (st.rot) ic.rotate(st.rot);
        ic.globalAlpha = st.a; ic.fillText(st.ch, 0, 0);
        ic.globalAlpha = st.a * .3; ic.fillText(st.ch, .7, .4);
        ic.restore();
      }
      const tc = this.tmpC.getContext('2d');
      tc.clearRect(0, 0, W, H);
      tc.globalCompositeOperation = 'source-over';
      tc.drawImage(this.inkC, 0, 0);
      tc.globalCompositeOperation = 'destination-out';
      tc.globalAlpha = .55 + (1 - P.ink) * .4;
      tc.drawImage(this.speckC, 0, 0);
      tc.globalAlpha = 1;
      tc.globalCompositeOperation = 'source-over';

      const ctx = this.ctx;
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, W, H);
      if (this.paper) {
        ctx.drawImage(this.paperC, 0, 0);
        ctx.globalCompositeOperation = 'multiply';
      }
      ctx.drawImage(this.tmpC, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    }

    // ---------- scroll ----------
    progress() {
      const r = this.track.getBoundingClientRect();
      const travel = r.height - innerHeight;
      if (travel <= 0) return r.top <= 0 ? 1 : 0;
      return Math.min(1, Math.max(0, -r.top / travel));
    }
    schedule() {
      if (this.queued) return;
      this.queued = true;
      requestAnimationFrame(() => {
        this.queued = false;
        const t = this.progress();
        const amount = Math.round((this.from + (this.to - this.from) * t) * 1000) / 1000;
        if (amount === this.amount && !this.dirty) return;
        this.amount = amount; this.dirty = false;
        this.P.amount = amount;
        this.render();
      });
    }
  }

  customElements.define('dattilogramma-scroll', DattilogrammaScroll);
})();
