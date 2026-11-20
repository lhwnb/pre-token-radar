// Pre-token radar - the page behind the board. No framework, no network, no fetch: data.js assigns
// window.RADAR and everything here reads it. Sorting is the reader's, rank is the model's: the number
// in the first column never moves, whatever the sort. The view lives in the URL hash, so every screen
// this page can show has an address that reproduces it.

const D = window.RADAR;
const rows = D.rows;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const money = (n) => {
  if (!Number.isFinite(n)) return '-';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(n >= 1e10 ? 1 : 2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}k`;
  return `$${Math.round(n)}`;
};
const pct = (n) => (n === null || n === undefined ? '-' : `${n > 0 ? '+' : ''}${n.toFixed(1)}%`);
const mult = (n) => `${n.toFixed(n < 1 ? 3 : 2)}x`;

/* ---- categories, colours, the live set --------------------------------------------------------- */

const catCount = new Map();
for (const r of rows) {
  const c = r.category ?? 'None';
  catCount.set(c, (catCount.get(c) ?? 0) + 1);
}
// The palette is assigned once, by how many rows a category carries, so a colour never moves.
const CATS = [...catCount.keys()].sort((a, b) => catCount.get(b) - catCount.get(a) || (a < b ? -1 : 1));
const HUES = ['#46e0a2', '#9d8cff', '#ffb86b', '#6ec1ff', '#ff8fc7', '#b6e26b', '#4fd6d0', '#ff9f5a', '#8f9dff', '#e3c78a', '#ff7a7a', '#8fa6bd'];
const colorOf = (c) => HUES[CATS.indexOf(c ?? 'None') % HUES.length];
const ANCHOR = new Map(D.anchors.map((a) => [a.category, a]));
const CHAINS = [...new Set(rows.flatMap((r) => r.chains))].sort();
const LIVE = D.live.filter((l) => l.ratio !== null);
const maxImplied = Math.max(...rows.map((r) => r.implied_value_usd));

/* ---- state and the URL hash -------------------------------------------------------------------- */

let state = { view: 'board', q: '', cat: '', chain: '', sort: 'rank', watch: false, open: null };

function hashOf() {
  const p = new URLSearchParams();
  if (state.q) p.set('q', state.q);
  if (state.cat) p.set('cat', state.cat);
  if (state.chain) p.set('chain', state.chain);
  if (state.sort !== 'rank') p.set('sort', state.sort);
  if (state.watch) p.set('watch', '1');
  if (state.open) p.set('open', state.open);
  const qs = p.toString();
  return `#/${state.view}${qs ? `?${qs}` : ''}`;
}

function readHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const cut = raw.indexOf('?');
  const path = cut < 0 ? raw : raw.slice(0, cut);
  const p = new URLSearchParams(cut < 0 ? '' : raw.slice(cut + 1));
  const parts = path.split('/').filter(Boolean);
  let view = 'board';
  let open = null;
  if (parts[0] === 'map' || parts[0] === 'live' || parts[0] === 'method') view = parts[0];
  if (parts[0] === 'p' && parts[1]) open = decodeURIComponent(parts.slice(1).join('/'));
  if (p.get('open')) open = p.get('open');
  return { view, q: p.get('q') ?? '', cat: p.get('cat') ?? '', chain: p.get('chain') ?? '', sort: p.get('sort') ?? 'rank', watch: p.get('watch') === '1', open };
}

/** Every change writes the hash; the hashchange listener is the one place that repaints. */
function setState(patch) {
  state = { ...state, ...patch };
  const h = hashOf();
  if (location.hash !== h) location.hash = h;
  else paint();
}

/* ---- header and formula strip ------------------------------------------------------------------ */

$('facts').innerHTML = [
  [money(D.floor_usd), 'watchlist floor'],
  [String(D.protocols_scanned), 'protocols scanned'],
  [String(D.board_size), 'ranked, no token'],
  [mult(D.field.median_ratio), 'live mcap / TVL'],
].map(([v, k]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');

$('strip').innerHTML = `
  <code>implied = TVL x anchor(category) x growth(7d) x maturity(age)</code>
  <span class="sep">|</span>
  <span>anchor learned from <b>${D.field.live_with_market_cap}</b> live protocols, median <b>${mult(D.field.median_ratio)}</b></span>
  <span class="sep">|</span>
  <span>model <b>${D.model_version}</b></span>
  <span class="sep">|</span>
  <span>snapshot <b>${D.as_of}</b></span>`;

/* ---- filters ----------------------------------------------------------------------------------- */

$('cat').innerHTML = `<option value="">every category</option>` + CATS.map((c) => `<option>${esc(c)}</option>`).join('');
$('chain').innerHTML = `<option value="">every chain</option>` + CHAINS.map((c) => `<option>${esc(c)}</option>`).join('');

function matches(r) {
  if (state.watch && !r.on_watchlist) return false;
  if (state.cat && (r.category ?? 'None') !== state.cat) return false;
  if (state.chain && !r.chains.includes(state.chain)) return false;
  const q = state.q.trim().toLowerCase();
  if (q && !`${r.name} ${r.category ?? ''} ${r.chains.join(' ')}`.toLowerCase().includes(q)) return false;
  return true;
}

function current() {
  const key = {
    rank: (a, b) => a.rank - b.rank,
    tvl: (a, b) => b.tvl_usd - a.tvl_usd,
    growth: (a, b) => (b.change_7d ?? -999) - (a.change_7d ?? -999),
    age: (a, b) => (b.age_days ?? 0) - (a.age_days ?? 0),
    pressure: (a, b) => b.launch_pressure - a.launch_pressure,
  }[state.sort] ?? ((a, b) => a.rank - b.rank);
  return rows.filter(matches).sort(key);
}

function pressureBar(p) {
  const lit = Math.round(p / 20);
  return `<span class="press" title="launch pressure ${p}/100">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= lit ? (lit >= 5 ? 'hot' : 'on') : ''}"></i>`).join('')}</span>`;
}

/* ---- the board --------------------------------------------------------------------------------- */

function renderBoard() {
  const list = current();
  $('count').innerHTML = `<b>${list.length}</b> of ${rows.length} rows - <b>${list.filter((r) => r.on_watchlist).length}</b> on the watchlist`;
  $('rows').innerHTML = list
    .map(
      (r) => `<tr data-slug="${esc(r.slug)}" tabindex="0">
      <td class="num rank ${r.rank <= 10 ? 'top' : ''}">${r.rank}</td>
      <td class="pname"><span class="name">${esc(r.name)}</span>${r.on_watchlist ? '<span class="pill watch">watchlist</span>' : ''}<div class="chain">${esc(r.chains.slice(0, 3).join(' / ') || 'no chain recorded')}</div></td>
      <td><span class="pill cat">${esc(r.category ?? 'none')}</span></td>
      <td class="num">${money(r.tvl_usd)}</td>
      <td class="num ${r.change_7d === null ? 'flat' : r.change_7d >= 0 ? 'up' : 'down'}">${pct(r.change_7d)}</td>
      <td class="num">${r.age_days === null ? '-' : `${r.age_days}d`}</td>
      <td class="num">${mult(r.anchor_ratio)}<span class="src"> ${r.anchor_source === 'category' ? `${r.anchor_members} live` : 'field'}</span></td>
      <td class="val"><div class="bar"><span class="track"><span class="fill" style="width:${Math.max(1.5, (r.implied_value_usd / maxImplied) * 100).toFixed(1)}%"></span></span><span class="amt">${money(r.implied_value_usd)}</span></div></td>
      <td class="num presscell">${pressureBar(r.launch_pressure)}<span class="pv">${r.launch_pressure}</span></td>
    </tr>`,
    )
    .join('') || `<tr><td colspan="9" class="empty">No protocol matches those filters. Clear one and the board comes back.</td></tr>`;
}

/* ---- the map ----------------------------------------------------------------------------------- */

const LADDER = [1e6, 2e6, 5e6, 1e7, 2e7, 5e7, 1e8, 2e8, 5e8, 1e9, 2e9, 5e9, 1e10];

/** The closest live protocol by TVL: same category when that category trades at all. */
function bench(r) {
  const pool = LIVE.filter((l) => l.slug !== r.slug);
  const same = pool.filter((l) => l.category === r.category);
  const from = same.length > 0 ? same : pool;
  const target = Math.log(r.tvl_usd);
  let best = null;
  let gap = Infinity;
  for (const l of from) {
    const d = Math.abs(Math.log(l.tvl_usd) - target);
    if (d < gap) {
      gap = d;
      best = l;
    }
  }
  return best === null ? null : { ...best, same: same.length > 0 };
}

function renderMap() {
  // With the drawer open the card is narrowed by 590px of CSS margin, so the viewBox follows it
  // and the plot renders 1:1 instead of being scaled down or hidden behind the drawer.
  const open = state.open !== null;
  const W = open ? 748 : 1338;
  const H = open ? 450 : 410;
  const m = { l: 66, r: 24, t: 16, b: 42 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const extent = (values) => {
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const pad = Math.max(0.05, (hi - lo) * 0.07);
    return [lo - pad, hi + pad];
  };
  const [x0, x1] = extent(rows.map((r) => Math.log10(r.tvl_usd)));
  const [y0, y1] = extent(rows.map((r) => Math.log10(r.implied_value_usd)));
  const X = (v) => m.l + ((Math.log10(v) - x0) / (x1 - x0)) * iw;
  const Y = (v) => m.t + ih - ((Math.log10(v) - y0) / (y1 - y0)) * ih;

  // The fair-value diagonal: implied = TVL x the field's median mcap/TVL, clipped to the plot.
  const k = Math.log10(D.field.median_ratio);
  const from = Math.max(x0, y0 - k);
  const to = Math.min(x1, y1 - k);

  // Axis labels stay short: $5M, $50M, $500M, $5B.
  const axis = (v) => (v >= 1e9 ? `$${(v / 1e9).toFixed(1).replace(/\.0$/, '')}B` : `$${Math.round(v / 1e6)}M`);

  let grid = '';
  let ticks = '';
  for (const v of LADDER) {
    const lx = Math.log10(v);
    if (lx >= x0 && lx <= x1) {
      const px = X(v).toFixed(1);
      grid += `<line x1="${px}" x2="${px}" y1="${m.t}" y2="${m.t + ih}"></line>`;
      ticks += `<text class="tick" x="${px}" y="${H - 22}" text-anchor="middle">${axis(v)}</text>`;
    }
    if (lx >= y0 && lx <= y1) {
      const py = Y(v).toFixed(1);
      grid += `<line x1="${m.l}" x2="${m.l + iw}" y1="${py}" y2="${py}"></line>`;
      ticks += `<text class="tick" x="${m.l - 9}" y="${py}" text-anchor="end" dy="3.5">${axis(v)}</text>`;
    }
  }

  const selected = rows.filter(matches);
  const picked = new Set(selected.map((r) => r.slug));
  const dots = [...rows]
    .sort((a, b) => Number(a.on_watchlist) - Number(b.on_watchlist))
    .map((r) => {
      const on = picked.has(r.slug);
      const cx = X(r.tvl_usd).toFixed(1);
      const cy = Y(r.implied_value_usd).toFixed(1);
      const rad = (r.on_watchlist ? 5.1 : 3.8) + (on && state.cat ? 0.5 : 0);
      const cls = `dot${r.on_watchlist ? ' watch' : ''}${on ? '' : ' dim'}`;
      return `<circle class="${cls}" cx="${cx}" cy="${cy}" r="${rad}" fill="${colorOf(r.category)}" data-slug="${esc(r.slug)}" tabindex="0"><title>${esc(r.name)} - TVL ${money(r.tvl_usd)}, implied ${money(r.implied_value_usd)}, rank ${r.rank}</title></circle>`;
    })
    .join('');

  // Name a couple of the largest rows in view, skipping any label that would collide or run off the edge.
  const placed = [];
  const labels = selected
    .slice(0, open ? 2 : 3)
    .map((r) => {
      const px = X(r.tvl_usd);
      const py = Y(r.implied_value_usd);
      if (px > m.l + iw - 130) return '';
      if (placed.some((p) => Math.abs(p[0] - px) < 120 && Math.abs(p[1] - py) < 16)) return '';
      placed.push([px, py]);
      return `<text class="dot-label" x="${(px + 8).toFixed(1)}" y="${(py - 7).toFixed(1)}">${esc(r.name)}</text>`;
    })
    .join('');

  const fair =
    to > from
      ? `<line class="fair" x1="${X(Math.pow(10, from)).toFixed(1)}" y1="${Y(Math.pow(10, from + k)).toFixed(1)}" x2="${X(Math.pow(10, to)).toFixed(1)}" y2="${Y(Math.pow(10, to + k)).toFixed(1)}"></line>
         <text class="fair-label" x="${(X(Math.pow(10, to)) - 8).toFixed(1)}" y="${(Y(Math.pow(10, to + k)) - 9).toFixed(1)}" text-anchor="end">fair value - implied = TVL x ${mult(D.field.median_ratio)}</text>`
      : '';

  $('plot').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="TVL against implied value, log scales">
    <rect class="frame" x="${m.l}" y="${m.t}" width="${iw}" height="${ih}"></rect>
    <g class="grid">${grid}</g>
    ${fair}
    <text class="axis-label" x="14" y="${(m.t + ih / 2).toFixed(0)}" transform="rotate(-90 14 ${(m.t + ih / 2).toFixed(0)})" text-anchor="middle">implied value, log</text>
    <text class="axis-label" x="${m.l}" y="${H - 5}">TVL, log</text>
    ${ticks}
    <g>${dots}</g>
    ${labels}
  </svg>`;

  // The legend is the palette itself, so it stays stable while a category filter is applied.
  const counts = new Map();
  for (const r of rows) counts.set(r.category ?? 'None', (counts.get(r.category ?? 'None') ?? 0) + 1);
  const chips = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([c, n]) => `<li class="${state.cat === c ? 'on' : ''}" data-cat="${esc(c)}"><span class="sw" style="background:${colorOf(c)}"></span>${esc(c)}<span class="n">${n}</span></li>`)
    .join('');
  const rest = counts.size > 6 ? `<li class="plain"><span class="n">+${counts.size - 6} more</span></li>` : '';
  $('legend').innerHTML = `${chips}${rest}<li class="plain"><span class="ring"></span><span class="n">watchlist</span></li>`;

  $('count').innerHTML = `<b>${selected.length}</b> of ${rows.length} dots in view - <b>${selected.filter((r) => r.on_watchlist).length}</b> on the watchlist`;
  $('mapfoot').innerHTML = `x: TVL, log scale. y: implied value, log scale. The dashed diagonal is <b>implied = TVL x ${mult(D.field.median_ratio)}</b>, the field median of the ${D.field.live_with_market_cap} live protocols that carry both a market cap and a TVL. Ringed dots sit on the house watchlist; the ${CATS.length} categories share a ${HUES.length}-colour palette, assigned by size. Click a dot for the arithmetic.`;
}

/* ---- the detail drawer ------------------------------------------------------------------------- */

function comparison(r) {
  const a = ANCHOR.get(r.category ?? 'None') ?? null;
  const catMedian = a === null ? null : a.median_ratio;
  const amax = Math.max(r.anchor_ratio, catMedian ?? 0, D.field.median_ratio) * 1.22;
  const w = (v) => ((v / amax) * 100).toFixed(1);
  const anchorBar = `<div class="cmp-row"><span class="cmp-k">anchor</span><div class="cmp-bar">
      <i class="mint" style="width:${w(r.anchor_ratio)}%"></i>
      ${catMedian === null ? '' : `<b title="category median ${mult(catMedian)}" style="left:${w(catMedian)}%"></b>`}
      <b class="field" title="field median ${mult(D.field.median_ratio)}" style="left:${w(D.field.median_ratio)}%"></b>
    </div><span class="cmp-v">${mult(r.anchor_ratio)}</span></div>
    <p class="cmp-note">${r.anchor_source === 'category'
      ? `bar: this row. solid tick: the ${r.anchor_members} live ${esc(r.category ?? '')} members (median ${mult(catMedian)}). dashed: the field (${mult(D.field.median_ratio)}).`
      : `bar: this row. dashed tick: the field median (${mult(D.field.median_ratio)}) - ${esc(r.category ?? 'this category')} has ${r.anchor_members} live member${r.anchor_members === 1 ? '' : 's'}, fewer than the ${D.model.anchor_min_members} a category needs.`}</p>`;

  const gmin = 1 - D.model.growth_weight;
  const gmax = 1 + D.model.growth_weight;
  const gw = ((r.growth_multiplier - gmin) / (gmax - gmin)) * 100;
  const gt = ((1 - gmin) / (gmax - gmin)) * 100;
  const growthBar = `<div class="cmp-row"><span class="cmp-k">growth</span><div class="cmp-bar">
      <i class="amber" style="width:${gw.toFixed(1)}%"></i><b title="a flat week" style="left:${gt.toFixed(1)}%"></b>
    </div><span class="cmp-v">${mult(r.growth_multiplier)}</span></div>
    <p class="cmp-note">1 + ${D.model.growth_weight} x tanh(${pct(r.change_7d)} / ${D.model.growth_scale}), bounded ${mult(gmin)} to ${mult(gmax)}; the tick is a flat week.</p>`;

  const maturityBar = `<div class="cmp-row"><span class="cmp-k">maturity</span><div class="cmp-bar">
      <i style="width:${(r.maturity_multiplier * 100).toFixed(1)}%"></i><b title="ceiling 1.00x" style="left:100%"></b>
    </div><span class="cmp-v">${mult(r.maturity_multiplier)}</span></div>
    <p class="cmp-note">${D.model.maturity_floor} + ${(1 - D.model.maturity_floor).toFixed(2)} x (1 - e^(-${r.age_days === null ? D.model.unknown_age_days : r.age_days} / ${D.model.maturity_tau_days})); the tick is the 1.00x ceiling.</p>`;

  return `<h3>Where the factors stand</h3><div class="cmp">${anchorBar}${growthBar}${maturityBar}</div>`;
}

function drawerHTML(r) {
  const b = bench(r);
  const benchLine = b === null ? '' : `<p class="bench">Bench against <b>${esc(b.name)}</b>${b.same ? ', the closest live member of the same category' : ', the closest live protocol by TVL'}: ${money(b.tvl_usd)} TVL and <b>${mult(b.ratio)}</b> market cap per dollar of TVL, ${mult(b.ratio / r.anchor_ratio)} the anchor this row uses.</p>`;
  return `
    <button class="close" id="close">close</button>
    <h2>${esc(r.name)}</h2>
    <p class="sub">rank ${r.rank} of ${rows.length} - ${esc(r.category ?? 'no category')} - ${esc(r.chains.join(' / ') || 'no chain recorded')} - ${r.on_watchlist ? 'on the house watchlist' : 'below the watchlist floor'} - ${r.age_days === null ? 'no listing date recorded' : `${r.age_days} days without a token`}</p>
    <div class="big"><div><div class="lbl">implied value</div><div class="usd">${money(r.implied_value_usd)}</div></div>
      <div><div class="lbl">launch pressure</div><div class="minor" style="color:var(--amber)">${r.launch_pressure}/100</div></div>
      <div><div class="lbl">7d TVL</div><div class="minor" style="color:${r.change_7d >= 0 ? 'var(--mint)' : 'var(--coral)'}">${pct(r.change_7d)}</div></div>
      <div><div class="lbl">TVL</div><div class="minor">${money(r.tvl_usd)}</div></div></div>
    ${r.risk_flags.length ? `<div class="flags">${r.risk_flags.map((f) => `<span>${esc(f)}</span>`).join('')}</div>` : ''}
    <div class="drawer-cols">
      <div class="col-a">
        <h3>The four factors, multiplied</h3>
        <div class="eq">
          <span class="f"><span class="k">TVL</span><b>${money(r.tvl_usd)}</b></span><span class="op">x</span>
          <span class="f"><span class="k">anchor</span><b>${mult(r.anchor_ratio)}</b></span><span class="op">x</span>
          <span class="f"><span class="k">growth</span><b>${mult(r.growth_multiplier)}</b></span><span class="op">x</span>
          <span class="f"><span class="k">maturity</span><b>${mult(r.maturity_multiplier)}</b></span>
          <span class="res">= ${money(r.implied_value_usd)}</span>
        </div>
        ${comparison(r)}
        ${benchLine}
      </div>
      <div class="col-b">
        <h3>Farm it before the token</h3>
        <ol class="steps">${r.farm_steps.map((s) => `<li><div>${esc(s.text)}<div class="meta">${s.cost ? `<span>${esc(s.cost)}</span>` : ''}${s.time ? `<span class="t">${esc(s.time)}</span>` : ''}</div></div></li>`).join('')}</ol>
      </div>
    </div>`;
}

function paintDrawer() {
  const r = state.open === null ? null : rows.find((v) => v.slug === state.open);
  for (const tr of document.querySelectorAll('#rows tr.sel')) tr.classList.remove('sel');
  document.body.classList.toggle('drawer-open', r !== null);
  if (r === null) {
    $('drawer').hidden = true;
    $('scrim').hidden = true;
    return;
  }
  $('drawer-in').innerHTML = drawerHTML(r);
  $('drawer').hidden = false;
  $('scrim').hidden = false;
  $('scrim').onclick = () => setState({ open: null });
  $('close').onclick = () => setState({ open: null });
  const sel = document.querySelector(`#rows tr[data-slug="${CSS.escape(r.slug)}"]`);
  if (sel !== null) sel.classList.add('sel');
}

/* ---- live tokens ------------------------------------------------------------------------------- */

function renderLive() {
  $('live-rows').innerHTML = D.live
    .map((r) => `<tr><td><span class="name">${esc(r.name)}</span><div class="chain">${esc(r.chains.slice(0, 3).join(' / '))}</div></td>
      <td><span class="pill cat">${esc(r.category ?? 'none')}</span></td>
      <td class="num">${money(r.tvl_usd)}</td>
      <td class="num">${r.mcap_usd === null ? '-' : money(r.mcap_usd)}</td>
      <td class="num ${r.change_7d === null ? 'flat' : r.change_7d >= 0 ? 'up' : 'down'}">${pct(r.change_7d)}</td>
      <td class="num">${r.ratio === null ? '-' : mult(r.ratio)}</td></tr>`)
    .join('');
}

/* ---- method ------------------------------------------------------------------------------------ */

function renderMethod() {
  const m = D.model;
  const anchorRows = D.anchors.slice(0, 12);
  $('method').innerHTML = `
  <div class="cov">
    <div><span class="ck">protocols scanned</span><span class="cv">${D.protocols_scanned}</span></div>
    <div><span class="ck">record no token</span><span class="cv">${D.pre_token_count}</span></div>
    <div><span class="ck">wrapped or bridged products, kept out</span><span class="cv">${D.product_count}</span></div>
    <div><span class="ck">ranked</span><span class="cv">${D.board_size}<small>rows</small></span></div>
    <div><span class="ck">on the watchlist</span><span class="cv">${D.watchlist_size}<small>above ${money(D.floor_usd)}</small></span></div>
    <div><span class="ck">live protocols with a market cap</span><span class="cv">${D.field.live_with_market_cap}<small>(${D.field.clamped_out} outside the clamp)</small></span></div>
  </div>
  <div class="method-grid">
    <div class="card">
      <h2>What this board claims, and what it does not</h2>
      <p>Every row answers one question: <b>if this protocol's record stayed exactly as the snapshot finds it, what would that token be worth?</b> The record is three figures - TVL, its seven-day change, and how long the protocol has run with no token recorded.</p>
      <p>The board does not predict whether a token is issued or when. A protocol is described as one that <i>records no token</i>, which is what the snapshot says, never as one that has none. Of ${D.pre_token_count} such protocols, ${D.product_count} are wrapped, staked or bridged products of a protocol whose token already trades and are kept out; <b>${D.board_size}</b> are ranked, the <b>${D.watchlist_size}</b> on the house watchlist among them.</p>
      <div class="formula">implied     = TVL x anchor(c) x growth(7d) x maturity(age)

anchor(c)   = clamp( (n x median(c) + ${m.anchor_prior_weight} x median(field)) / (n + ${m.anchor_prior_weight}),
              ${m.anchor_min_ratio}, ${m.anchor_max_ratio} )
growth(7d)  = 1 + ${m.growth_weight} x tanh( clamp(change_7d, ${m.growth_floor}, ${m.growth_cap}) / ${m.growth_scale} )
maturity(a) = ${m.maturity_floor} + ${(1 - m.maturity_floor).toFixed(2)} x (1 - e^(-a / ${m.maturity_tau_days}))</div>
      <p>The multiple is not invented. ${D.field.live_with_market_cap} protocols in this snapshot carry both a market cap and a TVL, so market cap per dollar of TVL is observable for them, and its median is <b>${mult(D.field.median_ratio)}</b>. A category's own median becomes its anchor, shrunk toward that field median by ${m.anchor_prior_weight} pseudo-observations; a category with fewer than ${m.anchor_min_members} live members borrows the field outright, so one outsized listing never becomes a multiple.</p>
      <p>Growth is bounded by tanh: a week that doubles TVL is worth at most ${mult(1 + m.growth_weight)}, a week that halves it at least ${mult(1 - m.growth_weight)}. Maturity credits age and never exceeds 1.00x. Launch pressure is a separate reading of how overdue a launch looks; it never changes the implied value.</p>
    </div>
    <div class="card">
      <h2>The anchors, as the snapshot set them</h2>
      <p>Each ranked category, the live members whose median set its multiple, and the multiple it used. The last column says whether the multiple is the category's own or the field's.</p>
      <table class="mini"><thead><tr><th>Category</th><th class="num">live</th><th class="num">median</th><th class="num">anchor</th><th class="num">rows</th><th>source</th></tr></thead><tbody>
      ${anchorRows.map((a) => `<tr><td>${esc(a.category)}</td><td class="num">${a.live_members}</td><td class="num">${a.median_ratio === null ? '-' : mult(a.median_ratio)}</td><td class="num">${mult(a.used_ratio)}</td><td class="num">${a.pre_token}</td><td class="src">${a.source === 'category' ? 'own members' : 'field median'}</td></tr>`).join('')}
      </tbody></table>
      <p class="src">${anchorRows.length} of ${D.anchors.length} categories, by live members. Every category and its anchor is in the page's data file.</p>
    </div>
  </div>`;
}

/* ---- routing ----------------------------------------------------------------------------------- */

function paint() {
  document.body.dataset.view = state.view;
  for (const t of document.querySelectorAll('.tabs button')) t.classList.toggle('on', t.dataset.view === state.view);
  $('controls').hidden = state.view !== 'board' && state.view !== 'map';
  $('view-board').hidden = state.view !== 'board';
  $('view-map').hidden = state.view !== 'map';
  $('view-live').hidden = state.view !== 'live';
  $('view-method').hidden = state.view !== 'method';
  if (state.view === 'board') renderBoard();
  if (state.view === 'map') renderMap();
  if (state.view === 'live') renderLive();
  if (state.view === 'method') renderMethod();
  paintDrawer();
  $('hash').textContent = hashOf();
}

function route() {
  state = readHash();
  if (state.cat && !CATS.includes(state.cat)) state.cat = '';
  if (state.chain && !CHAINS.includes(state.chain)) state.chain = '';
  if ($('q').value !== state.q) $('q').value = state.q;
  $('cat').value = state.cat;
  $('chain').value = state.chain;
  $('sort').value = state.sort;
  $('watch').checked = state.watch;
  paint();
}

for (const t of document.querySelectorAll('.tabs button')) t.onclick = () => setState({ view: t.dataset.view, open: null });
$('q').oninput = (e) => setState({ q: e.target.value });
$('cat').onchange = (e) => setState({ cat: e.target.value });
$('chain').onchange = (e) => setState({ chain: e.target.value });
$('sort').onchange = (e) => setState({ sort: e.target.value });
$('watch').onchange = (e) => setState({ watch: e.target.checked });

$('rows').onclick = (e) => {
  const tr = e.target.closest('tr[data-slug]');
  if (tr !== null) setState({ open: tr.dataset.slug });
};
$('rows').onkeydown = (e) => {
  if (e.key !== 'Enter') return;
  const tr = e.target.closest('tr[data-slug]');
  if (tr !== null) setState({ open: tr.dataset.slug });
};
$('plot').onclick = (e) => {
  const dot = e.target.closest('.dot');
  if (dot !== null) setState({ open: dot.dataset.slug });
};
$('plot').onkeydown = (e) => {
  if (e.key !== 'Enter') return;
  const dot = e.target.closest('.dot');
  if (dot !== null) setState({ open: dot.dataset.slug });
};
$('legend').onclick = (e) => {
  const li = e.target.closest('li[data-cat]');
  if (li !== null) setState({ cat: state.cat === li.dataset.cat ? '' : li.dataset.cat });
};
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.open !== null) setState({ open: null });
});

addEventListener('hashchange', route);
route();
