/* All data comes from data/*.toml, validated and inlined by build.py as window.__DATA__.
   Below it is reshaped into the compact structures the renderers use. Edit the TOML, not this. */
const D = window.__DATA__;
const SITE = D.site, YMIN = SITE.first_year, YMAX = SITE.last_year;

const W = s => 'https://en.wikipedia.org/wiki/' + s;
const MOBY = q => 'https://www.mobygames.com/search/?q=' + encodeURIComponent(q);
const CODEX = q => 'https://wiki.ultimacodex.com/index.php?search=' + encodeURIComponent(q);
const pairs = list => (list || []).map(l => [l.name, l.url || null]);

const GAMES = D.games.map(g => ({
  id: g.id, ord: g.ord, t: g.title, a: g.short, era: g.era, wiki: g.wiki, q: g.query,
  buy: (g.buy || []).map(b => [b.name, b.url, !!b.free]),
}));
const GMAP = Object.fromEntries(GAMES.map(g => [g.id, g]));

const TYPES = Object.fromEntries(Object.entries(D.types).map(([id, t]) =>
  [id, { l: t.label, c: `var(--t-${id})`, s: t.shape === 'diamond' ? 'dia' : 'dot' }]));

const PLAT = Object.fromEntries(Object.entries(D.platforms).map(([id, p]) =>
  [id, { s: p.name, col: p.column, emu: pairs(p.emulators), hw: p.original, store: !!p.store }]));

const V = D.releases.map(r => ({
  g: r.game, y: r.year ?? null, p: r.platform || null, type: r.type, label: r.label, note: r.note,
  c: r.approx, needs: r.needs_data, col: r.column,
  links: r.links.length ? pairs(r.links) : undefined, play: r.play ? pairs(r.play) : undefined,
}));

/* ======================= THEMES ======================= */
const THEMES = [
  { id: 'twilight', name: 'Twilight', a: '#26324f', b: '#e3c581' },
  { id: 'moongate', name: 'Moongate', a: '#2d4973', b: '#efd48f' },
  { id: 'dawn',     name: 'Dawn',     a: '#fbf9f1', b: '#8a6410' },
];
function setTheme(id) {
  if (!THEMES.some(t => t.id === id)) id = 'twilight';
  document.documentElement.dataset.theme = id;
  try { localStorage.setItem('ultima-theme', id); } catch (_) {}
  document.querySelectorAll('.themes button').forEach(b => b.setAttribute('aria-pressed', b.dataset.theme === id));
}
function renderThemes() {
  const box = document.getElementById('themes');
  box.innerHTML = '<span class="lab">Theme</span>' + THEMES.map(t =>
    `<button type="button" data-theme="${t.id}" aria-pressed="false"><span class="sw" style="--a:${t.a};--b:${t.b}"></span>${t.name}</button>`).join('');
  box.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setTheme(b.dataset.theme); });
  setTheme(document.documentElement.dataset.theme);
}

/* ======================= STATE ======================= */
V.forEach((x, i) => { x.id = 'v' + i; x.col = x.col || (x.p && PLAT[x.p].col); });
const state = { types: new Set(Object.keys(TYPES)), game: '' };
const visible = x => state.types.has(x.type);

/* ======================= HELPERS ======================= */
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const typeColor = t => TYPES[t].c;
const yearText = x => x.y == null ? 'Date unknown' : (x.c ? 'c. ' : '') + x.y;
function platLabel(x) {
  if (x.p) return PLAT[x.p].s;
  return x.label.replace(/\s*\(.*\)\s*$/, '');
}
function chipText(x) {
  const g = GMAP[x.g];
  return { g: g.a, p: x.p ? PLAT[x.p].s + (x.type === 'remake' ? ' remake' : '') : x.label };
}
function primaryUrl(x) {
  if (x.links && x.links.length) return x.links[0][1];
  return W(GMAP[x.g].wiki);
}

/* ======================= LEDE / CONTROLS ======================= */
const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
function renderLede() {
  const n = V.length, rec = V.filter(x => ['engine','decomp','fan'].includes(x.type)).length;
  document.getElementById('lede').innerHTML =
    md(SITE.lede).replace('{versions}', n).replace('{recreations}', rec);
  document.getElementById('hint-tl').textContent =
    `Scroll sideways through ${YMIN}–${YMAX}. Select any release to open its card.`;
  document.getElementById('footer').innerHTML = (SITE.footer || []).map(p => `<p>${md(p)}</p>`).join('');
  document.getElementById('h1-text').textContent = SITE.title;
}
function renderControls() {
  const wrap = document.getElementById('typechips');
  wrap.innerHTML = Object.entries(TYPES).map(([k, t]) =>
    `<button type="button" class="tchip" data-type="${k}" aria-pressed="true" style="--c:${t.c}"><span class="mark ${t.s === 'dia' ? 'dia' : ''}"></span>${t.l}</button>`).join('');
  wrap.addEventListener('click', e => {
    const b = e.target.closest('.tchip'); if (!b) return;
    const k = b.dataset.type;
    if (state.types.has(k)) state.types.delete(k); else state.types.add(k);
    b.setAttribute('aria-pressed', state.types.has(k));
    applyFilters(); renderTable(); renderCompact();
  });
  const sel = document.getElementById('gamesel');
  sel.insertAdjacentHTML('beforeend', GAMES.map(g => `<option value="${g.id}">${esc(g.t)}</option>`).join(''));
  sel.addEventListener('change', () => { state.game = sel.value; applyFilters(); renderTable(); renderCompact(); });
}

/* ======================= TIMELINE ======================= */
const MAX_STACK = 7;
function renderTimeline() {
  const track = document.getElementById('track');
  const dated = V.filter(x => x.y != null).sort((a, b) => a.y - b.y || GAMES.indexOf(GMAP[a.g]) - GAMES.indexOf(GMAP[b.g]));
  const byYear = {};
  dated.forEach(x => (byYear[x.y] = byYear[x.y] || []).push(x));
  let html = '';
  for (let y = YMIN; y <= YMAX; y++) {
    const items = byYear[y] || [];
    if (!items.length) {
      html += `<div class="yr empty ${y % 5 === 0 ? 'decade' : ''}" data-year="${y}"><div class="stacks"></div><div class="axis"><span class="ylab">${y}</span></div></div>`;
      continue;
    }
    let stacks = '';
    for (let i = 0; i < items.length; i += MAX_STACK) {
      stacks += '<div class="stack">' + items.slice(i, i + MAX_STACK).map(chipHtml).join('') + '</div>';
    }
    html += `<div class="yr full" data-year="${y}"><div class="stacks">${stacks}</div><div class="axis"><span class="ylab">${y}</span></div></div>`;
  }
  track.innerHTML = html;
  const und = V.filter(x => x.y == null).length;
  document.getElementById('undated').textContent = und ? `${und} undated versions are listed in the canon table.` : '';
}
function chipHtml(x) {
  const t = chipText(x);
  return `<a class="chip" href="${esc(primaryUrl(x))}" data-v="${x.id}" style="--c:${typeColor(x.type)}" title="${esc(GMAP[x.g].t + ' · ' + x.label + ' · ' + yearText(x))}"><span class="g">${esc(t.g)}</span><span class="p">${esc(t.p)}</span></a>`;
}
function applyFilters() {
  document.querySelectorAll('.chip').forEach(el => {
    const x = V[+el.dataset.v.slice(1)];
    el.classList.toggle('hidden', !visible(x));
    el.classList.toggle('dim', !!state.game && x.g !== state.game);
  });
}

/* ======================= COMPACT TIMELINE ======================= */
const CP = { padL: 28, padR: 150, yBase: 14, perItem: 9, lane: 30, cardW: 120, cardH: 24, band: 44, gap: 6, margin: 14 };
function renderCompact() {
  const track = document.getElementById('cptrack');
  const items = V.filter(x => x.y != null && visible(x))
                 .sort((a, b) => a.y - b.y || GAMES.indexOf(GMAP[a.g]) - GAMES.indexOf(GMAP[b.g]));
  const byYear = {};
  items.forEach(x => (byYear[x.y] = byYear[x.y] || []).push(x));
  // compressed x scale: every year gets a little room, plus a bit per release in it
  const yearX = {}; let x = CP.padL;
  for (let y = YMIN; y <= YMAX; y++) {
    const n = (byYear[y] || []).length, w = CP.yBase + n * CP.perItem;
    yearX[y] = { x0: x, w, n }; x += w;
  }
  const width = x + CP.padR;
  // dot positions, spread inside each year
  items.forEach(it => {
    const Y = yearX[it.y], i = byYear[it.y].indexOf(it);
    it._x = Y.x0 + 4 + (i + 0.5) * (Y.w - 8) / Y.n;
  });
  // greedy lanes, alternating above / below; a lane is free once the previous card in it has ended
  const above = [], below = [];
  items.forEach(it => {
    const left = it._x - 6;
    for (let k = 0; ; k++) {
      const side = k % 2 === 0 ? above : below, lane = k >> 1;
      if (side[lane] === undefined || side[lane] + CP.gap <= left) {
        side[lane] = left + CP.cardW; it._side = k % 2 === 0 ? 'a' : 'b'; it._lane = lane; break;
      }
    }
  });
  const A = above.length, B = below.length;
  const axisTop = CP.margin + A * CP.lane, axisY = axisTop + 12, axisBot = axisTop + CP.band;
  const height = axisBot + B * CP.lane + CP.margin;
  let svg = `<svg width="${width}" height="${height}" aria-hidden="true">`;
  svg += `<line class="cp-axis" x1="${CP.padL}" x2="${width - CP.padR + 20}" y1="${axisY}" y2="${axisY}"/>`;
  let labels = '';
  for (let y = YMIN; y <= YMAX; y++) {
    const Y = yearX[y], major = y % 5 === 0;
    svg += `<line class="cp-tick${major ? ' major' : ''}" x1="${Y.x0}" x2="${Y.x0}" y1="${axisY - (major ? 6 : 3)}" y2="${axisY + (major ? 6 : 3)}"/>`;
    if (major || Y.n >= 2) labels += `<span class="cp-year${major ? ' major' : ''}" style="left:${Y.x0 + Y.w / 2}px;top:${axisY + 4}px">${y}</span>`;
  }
  let cards = '';
  items.forEach(it => {
    const c = typeColor(it.type), left = it._x - 6;
    const top = it._side === 'a' ? axisTop - (it._lane + 1) * CP.lane + (CP.lane - CP.cardH) - 2
                                 : axisBot + it._lane * CP.lane + 2;
    const yEnd = it._side === 'a' ? top + CP.cardH : top;
    const dim = state.game && it.g !== state.game;
    svg += `<line class="cp-lead${dim ? ' cp-dim' : ''}" stroke="${c}" x1="${it._x}" x2="${it._x}" y1="${axisY}" y2="${yEnd}"/>`;
    svg += `<circle class="cp-dot${dim ? ' cp-dim' : ''}" fill="${c}" cx="${it._x}" cy="${axisY}" r="3.5"/>`;
    const t = chipText(it);
    cards += `<a class="cpc${dim ? ' dim' : ''}" href="${esc(primaryUrl(it))}" data-v="${it.id}" style="--c:${c};left:${left}px;top:${top}px;width:${CP.cardW}px" title="${esc(GMAP[it.g].t + ' · ' + it.label + ' · ' + yearText(it))}"><span class="g">${esc(t.g)}</span><span class="p">${esc(t.p)}</span></a>`;
  });
  svg += '</svg>';
  track.style.width = width + 'px'; track.style.height = height + 'px';
  track.innerHTML = svg + labels + cards;
  document.getElementById('cp-count').textContent = `${items.length} releases · ${A + B} lanes · ${Math.round(width).toLocaleString()} px wide`;
}

/* ======================= TABLE ======================= */
const COLS = SITE.columns.map(c => [c.id, c.label, !!c.group]);
function renderTable() {
  const head = `<thead><tr><th scope="col">Game (canon order)</th>${COLS.map(c => `<th scope="col" class="${c[2] ? 'grp' : ''}">${c[1]}</th>`).join('')}<th scope="col" class="grp">Buy today</th></tr></thead>`;
  let body = '', lastEra = '';
  GAMES.forEach(g => {
    if (g.era !== lastEra) {
      body += `<tr class="era"><th scope="rowgroup" colspan="1">${esc(g.era)}</th><td colspan="${COLS.length + 1}"></td></tr>`;
      lastEra = g.era;
    }
    const dim = state.game && state.game !== g.id ? ' style="opacity:.3"' : '';
    const first = V.filter(x => x.g === g.id && x.y != null).reduce((m, x) => Math.min(m, x.y), 9999);
    let row = `<tr${dim}><th scope="row"><span class="ord">${g.ord}</span><a class="gname" href="${W(g.wiki)}">${esc(g.t)}</a><span class="gmeta">First released ${first} · <a href="${MOBY(g.q)}">MobyGames</a> · <a href="${CODEX(g.q)}">Codex</a></span></th>`;
    COLS.forEach(([col]) => {
      const vs = V.filter(x => x.g === g.id && x.col === col && visible(x))
                  .sort((a, b) => (a.y ?? 9999) - (b.y ?? 9999));
      if (!vs.length) { row += '<td class="empty"></td>'; return; }
      const nums = vs.map((x, i) => `<a class="vlink" href="${esc(primaryUrl(x))}" data-v="${x.id}" style="--c:${typeColor(x.type)}" title="${esc(x.label + ' · ' + yearText(x))}">${i + 1}</a>`).join('<span class="sep">,</span>');
      const plats = vs.map((x, i) => `<span style="--c:${typeColor(x.type)}"><b>${i + 1}</b>${esc(platLabel(x))}${x.y ? ' ’' + String(x.y).slice(2) : ''}</span>`).join('');
      const wide = ['jp','console','engine','decomp','fan'].includes(col) ? ' class="wide"' : '';
      row += `<td${wide}><div class="cell"><span class="br">[</span>${nums}<span class="br">]</span><span class="plat">${plats}</span></div></td>`;
    });
    row += g.buy.length ? '' : '<td class="buy"><span class="gmeta">Not re-released</span></td></tr>';
    if (!g.buy.length) { body += row; return; }
    row += `<td class="buy">${g.buy.map(([n, u, free]) => `<a href="${u}">${esc(n)}</a>${free ? '<span class="free">free</span>' : ''}`).join('<br>')}</td></tr>`;
    body += row;
  });
  document.getElementById('tbl').innerHTML = head + '<tbody>' + body + '</tbody>';
}

/* ======================= CARD ======================= */
const card = document.getElementById('card');
let activeEl = null;
function linkList(arr) {
  return arr.map(([n, u]) => u ? `<a href="${esc(u)}">${esc(n)}</a>` : `<span>${esc(n)}</span>`).join('');
}
function openCard(x, anchor) {
  const g = GMAP[x.g], t = TYPES[x.type], p = x.p ? PLAT[x.p] : null;
  const isRec = ['engine','decomp','fan'].includes(x.type);
  const info = [['Wikipedia', W(g.wiki)], ['MobyGames', MOBY(g.q)], ['Ultima Codex', CODEX(g.q)]];
  let play = [];
  if (p) {
    if (p.store) play.push(['Store copy', 'Today\'s GOG / Steam release (runs in DOSBox or natively)']);
    if (p.emu.length) play.push(['Emulation', p.emu.map(([n, u]) => `<a href="${esc(u)}">${esc(n)}</a>`).join(' · ')]);
    play.push(['Original', esc(p.hw)]);
  }
  if (isRec) {
    if (x.play) play.push(['Get it', x.play.map(([n, u]) => u ? `<a href="${esc(u)}">${esc(n)}</a>` : esc(n)).join(' · ')]);
    else play.push(['Get it', x.links.map(([n, u]) => `<a href="${esc(u)}">${esc(n)}</a>`).join(' · ')]);
    if (x.type !== 'fan' || x.needs)
      play.push(['Needs', 'Game data from a copy you own. Store copies below work.']);
  }
  card.style.setProperty('--c', t.c);
  card.innerHTML = `
    <button type="button" class="close" aria-label="Close card">×</button>
    <div class="kick"><span class="mark ${t.s === 'dia' ? 'dia' : ''}" style="--c:${t.c}"></span>${esc(t.l)} · ${esc(yearText(x))}</div>
    <h2 id="card-title">${esc(x.label)}</h2>
    <p class="sub">${esc(g.t)}${p ? ' · ' + esc(p.s) : ''}</p>
    <p class="note">${esc(x.note)}</p>
    ${x.links && x.links.length ? `<h3>Project links</h3><div class="links">${linkList(x.links)}</div>` : ''}
    <h3>More about the game</h3><div class="links">${linkList(info)}</div>
    <h3>Ways to play this version</h3>
    <ul>${play.map(([k, val]) => `<li><span class="k">${esc(k)}</span><span>${val}</span></li>`).join('')}</ul>
    <h3>Buy the game today</h3>${g.buy.length ? `<div class="links">${g.buy.map(([n, u, free]) => `<a href="${esc(u)}">${esc(n)}${free ? ' (free)' : ''}</a>`).join('')}</div>` : '<p class="note">Not sold today: only the original cartridges exist.</p>'}
    ${p && !p.store && g.buy.length ? '<p class="warn">Store releases contain the MS-DOS version. For this one, dump your own original disks or cartridge.</p>' : ''}
  `;
  card.hidden = false;
  if (activeEl) activeEl.classList.remove('active');
  activeEl = anchor; anchor.classList.add('active');
  position(anchor);
  card.querySelector('.close').focus({ preventScroll: true });
}
function position(anchor) {
  if (window.innerWidth <= 640) return;
  const r = anchor.getBoundingClientRect(), cw = card.offsetWidth, ch = card.offsetHeight, m = 12;
  let left = r.right + 10;
  if (left + cw > window.innerWidth - m) left = r.left - cw - 10;
  if (left < m) left = Math.max(m, Math.min(window.innerWidth - cw - m, r.left));
  let top = r.top - 20;
  if (top + ch > window.innerHeight - m) top = window.innerHeight - ch - m;
  if (top < m) top = m;
  card.style.left = left + 'px'; card.style.top = top + 'px';
}
function closeCard() {
  card.hidden = true;
  if (activeEl) { activeEl.classList.remove('active'); activeEl.focus({ preventScroll: true }); activeEl = null; }
}
document.addEventListener('click', e => {
  const a = e.target.closest('[data-v]');
  if (a && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
    e.preventDefault();
    openCard(V[+a.dataset.v.slice(1)], a);
    return;
  }
  if (e.target.closest('.close')) { closeCard(); return; }
  if (!card.hidden && !card.contains(e.target)) closeCard();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !card.hidden) closeCard(); });
document.getElementById('tlscroll').addEventListener('scroll', () => { if (!card.hidden) closeCard(); }, { passive: true });
window.addEventListener('resize', () => { if (!card.hidden && activeEl) position(activeEl); });

/* ======================= VIEW SWITCH ======================= */
const VIEWS = ['timeline', 'compact', 'table'];
function show(view) {
  if (!VIEWS.includes(view)) view = 'timeline';
  VIEWS.forEach(v => {
    document.getElementById('view-' + v).hidden = v !== view;
    document.getElementById('btn-' + v).setAttribute('aria-pressed', v === view);
  });
  if (!card.hidden) closeCard();
}
function go(view) {
  try { if (location.hash !== '#' + view) location.hash = view; } catch (_) {}
  show(view);
}
document.getElementById('btn-timeline').addEventListener('click', () => go('timeline'));
document.getElementById('btn-table').addEventListener('click', () => go('table'));
document.getElementById('btn-compact').addEventListener('click', () => go('compact'));
document.getElementById('cpscroll').addEventListener('scroll', () => { if (!card.hidden) closeCard(); }, { passive: true });
window.addEventListener('hashchange', () => show(location.hash.slice(1)));

/* ======================= INIT ======================= */
renderThemes(); renderLede(); renderControls(); renderTimeline(); renderCompact(); renderTable(); applyFilters();
show(location.hash.slice(1));
