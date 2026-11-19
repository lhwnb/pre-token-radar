// Pre-token radar — the page behind the board. No framework, no network, no fetch: data.js assigns
// window.RADAR and everything here reads it. Sorting is the reader's, rank is the model's: the number in
// the first column never moves, whatever the sort.

const D = window.RADAR;
const rows = D.rows;
const money = (n) => (n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}k` : `$${Math.round(n)}`);
const pct = (n) => (n === null || n === undefined ? '—' : `${n > 0 ? '+' : ''}${n.toFixed(1)}%`);
const x = (n) => `${n.toFixed(2)}×`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const $ = (id) => document.getElementById(id);

const state = { q: '', cat: '', chain: '', sort: 'rank', watch: false };
const maxImplied = Math.max(...rows.map((r) => r.implied_value_usd));

/* ---- header and formula strip ------------------------------------------------------------------ */

$('facts').innerHTML = [
  [money(D.floor_usd), 'watchlist floor'],
  [String(D.protocols_scanned), 'protocols scanned'],
  [String(D.board_size), 'ranked, no token'],
  [x(D.field.median_ratio), 'live mcap / TVL'],
].map(([v, k]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');

$('strip').innerHTML = `
  <code>implied = TVL × anchor(category) × growth(7d) × maturity(age)</code>
  <span class="sep">·</span>
  <span>anchor learned from <b>${D.field.live_with_market_cap}</b> live protocols, median <b>${x(D.field.median_ratio)}</b></span>
  <span class="sep">·</span>
  <span>model <b>${D.model_version}</b></span>
  <span class="sep">·</span>
  <span>snapshot <b>${D.as_of}</b></span>`;

/* ---- filters ----------------------------------------------------------------------------------- */

const cats = [...new Set(rows.map((r) => r.category ?? 'no category'))].sort();
const chains = [...new Set(rows.flatMap((r) => r.chains))].sort();
$('cat').innerHTML = `<option value="">every category</option>` + cats.map((c) => `<option>${esc(c)}</option>`).join('');
$('chain').innerHTML = `<option value="">every chain</option>` + chains.map((c) => `<option>${esc(c)}</option>`).join('');

function current() {
  const q = state.q.trim().toLowerCase();
  const out = rows.filter((r) => {
    if (state.watch && !r.on_watchlist) return false;
    if (state.cat && (r.category ?? 'no category') !== state.cat) return false;
    if (state.chain && !r.chains.includes(state.chain)) return false;
    if (q && !`${r.name} ${r.category ?? ''} ${r.chains.join(' ')}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const key = {
    rank: (a, b) => a.rank - b.rank,
    tvl: (a, b) => b.tvl_usd - a.tvl_usd,
    growth: (a, b) => (b.change_7d ?? -999) - (a.change_7d ?? -999),
    age: (a, b) => (b.age_days ?? 0) - (a.age_days ?? 0),
    pressure: (a, b) => b.launch_pressure - a.launch_pressure,
  }[state.sort];
  return out.sort(key);
}

function pressureBar(p) {
  const lit = Math.round(p / 20);
  return `<span class="press" title="launch pressure ${p}/100">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= lit ? (lit >= 5 ? 'hot' : 'on') : ''}"></i>`).join('')}</span>`;
}

function renderBoard() {
  const list = current();
  $('count').textContent = `${list.length} of ${rows.length} rows · ${list.filter((r) => r.on_watchlist).length} on the watchlist`;
  $('rows').innerHTML = list
    .map(
      (r) => `<tr data-slug="${esc(r.slug)}">
      <td class="num rank ${r.rank <= 10 ? 'top' : ''}">${r.rank}</td>
      <td><span class="name">${esc(r.name)}</span>${r.on_watchlist ? '<span class="pill watch">watchlist</span>' : ''}<div class="chain">${esc(r.chains.slice(0, 3).join(' · ') || 'no chain recorded')}</div></td>
      <td><span class="pill cat">${esc(r.category ?? 'none')}</span></td>
      <td class="num">${money(r.tvl_usd)}</td>
      <td class="num ${r.change_7d === null ? 'flat' : r.change_7d >= 0 ? 'up' : 'down'}">${pct(r.change_7d)}</td>
      <td class="num">${r.age_days === null ? '—' : `${r.age_days}d`}</td>
      <td class="num">${x(r.anchor_ratio)}<span class="src"> ${r.anchor_source === 'category' ? `${r.anchor_members} live` : 'field'}</span></td>
      <td class="val"><div class="bar"><span class="track"><span class="fill" style="width:${Math.max(2, (r.implied_value_usd / maxImplied) * 100)}%"></span></span><span class="amt">${money(r.implied_value_usd)}</span></div></td>
      <td class="num">${pressureBar(r.launch_pressure)}</td>
    </tr>`,
    )
    .join('') || `<tr><td colspan="9" class="empty">No protocol matches those filters.</td></tr>`;
}

/* ---- detail drawer ----------------------------------------------------------------------------- */

function openDetail(slug) {
  const r = rows.find((v) => v.slug === slug);
  if (!r) return;
  const top = Math.max(r.tvl_usd, r.implied_value_usd);
  const flow = [
    ['TVL', money(r.tvl_usd), (r.tvl_usd / top) * 100, 'f1'],
    ['× anchor', x(r.anchor_ratio), (r.anchor_ratio / D.model.anchor_max_ratio) * 100, 'f2'],
    ['× growth', x(r.growth_multiplier), (r.growth_multiplier / 1.55) * 100, 'f3'],
    ['× maturity', x(r.maturity_multiplier), (r.maturity_multiplier / 1) * 100, 'f2'],
  ];
  $('drawer-in').innerHTML = `
    <button class="close" id="close">close</button>
    <h2>${esc(r.name)}</h2>
    <p class="sub">rank ${r.rank} of ${rows.length} · ${esc(r.category ?? 'no category')} · ${esc(r.chains.join(' · ') || 'no chain recorded')} · ${r.on_watchlist ? 'on the house watchlist' : 'below the watchlist floor'} · ${r.age_days === null ? 'no listing date recorded' : `${r.age_days} days without a token`}</p>
    <div class="big"><div><div class="lbl">implied value</div><div class="usd">${money(r.implied_value_usd)}</div></div>
      <div><div class="lbl">launch pressure</div><div class="usd" style="font-size:22px;color:var(--amber)">${r.launch_pressure}/100</div></div>
      <div><div class="lbl">7d TVL</div><div class="usd" style="font-size:22px;color:${r.change_7d >= 0 ? 'var(--mint)' : 'var(--coral)'}">${pct(r.change_7d)}</div></div></div>
    ${r.risk_flags.length ? `<div class="flags">${r.risk_flags.map((f) => `<span>${esc(f)}</span>`).join('')}</div>` : ''}
    <h3>How the number is built</h3>
    <div class="chain-flow">
      ${flow.map(([k, v, w, cls]) => `<div class="flow-row"><span class="k">${k}</span><span class="track"><span class="fill ${cls}" style="width:${Math.max(2, Math.min(100, w))}%"></span></span><span class="v">${v}</span></div>`).join('')}
      <div class="flow-row total"><span class="k">implied value</span><span class="track"><span class="fill f4" style="width:${(r.implied_value_usd / top) * 100}%"></span></span><span class="v">${money(r.implied_value_usd)}</span></div>
    </div>
    <p class="src">The anchor is ${r.anchor_source === 'category'
      ? `the median market cap per dollar of TVL of the ${r.anchor_members} live ${esc(r.category ?? '')} protocols in this snapshot, shrunk toward the field's ${x(D.field.median_ratio)}`
      : `the field's median market cap per dollar of TVL: this category has ${r.anchor_members} live member${r.anchor_members === 1 ? '' : 's'}, fewer than the ${D.model.anchor_min_members} a category needs before its own median counts as a sample`}.</p>
    <h3>Farm it before the token</h3>
    <ol class="steps">${r.farm_steps.map((s) => `<li><div>${esc(s.text)}<div class="meta">${s.cost ? `<span>${esc(s.cost)}</span>` : ''}${s.time ? `<span>${esc(s.time)}</span>` : ''}</div></div></li>`).join('')}</ol>`;
  $('drawer').hidden = false;
  $('close').onclick = () => closeDetail();
  for (const tr of document.querySelectorAll('#rows tr.sel')) tr.classList.remove('sel');
  const sel = document.querySelector(`#rows tr[data-slug="${CSS.escape(r.slug)}"]`);
  if (sel) sel.classList.add('sel');
}

function closeDetail() {
  $('drawer').hidden = true;
  if (location.hash.startsWith('#/p/')) history.replaceState(null, '', '#/');
}

/* ---- live tokens ------------------------------------------------------------------------------- */

function renderLive() {
  $('live-rows').innerHTML = D.live
    .map((r) => `<tr><td><span class="name">${esc(r.name)}</span><div class="chain">${esc(r.chains.slice(0, 3).join(' · '))}</div></td>
      <td><span class="pill cat">${esc(r.category ?? 'none')}</span></td>
      <td class="num">${money(r.tvl_usd)}</td>
      <td class="num">${r.mcap_usd === null ? '—' : money(r.mcap_usd)}</td>
      <td class="num ${r.change_7d === null ? 'flat' : r.change_7d >= 0 ? 'up' : 'down'}">${pct(r.change_7d)}</td>
      <td class="num">${r.ratio === null ? '—' : x(r.ratio)}</td></tr>`)
    .join('');
}

/* ---- method ------------------------------------------------------------------------------------ */

function renderMethod() {
  const m = D.model;
  const growthHigh = x(1 + m.growth_weight);
  const growthLow = x(1 - m.growth_weight);
  $('method').innerHTML = `
  <div class="method">
    <div class="card">
      <h2>What this board claims, and what it does not</h2>
      <p>A protocol's launch is the token it may issue one day. Every row answers one question: <b>if this protocol's record stayed exactly as the snapshot finds it, what would that token be worth?</b> The record is three figures — TVL, its seven-day change, and how long the protocol has run with no token recorded.</p>
      <p>The board does not predict whether a token is issued or when. A protocol is described as one that <i>records no token</i>, which is what the snapshot says; it is never described as one that has none. ${D.pre_token_count} protocols record no token; ${D.product_count} of them are wrapped, staked or bridged products of a protocol whose token already trades — WBTC, USDT0, a staked receipt — and are kept out, which leaves <b>${D.board_size}</b> ranked, the ${D.watchlist_size} on the house watchlist among them.</p>
      <div class="formula">implied value = TVL × anchor(category) × growth(7d) × maturity(age)

anchor(category) = clamp( (n·median(category) + ${m.anchor_prior_weight}·median(field)) / (n + ${m.anchor_prior_weight}), ${m.anchor_min_ratio}, ${m.anchor_max_ratio} )
growth(7d)       = 1 + ${m.growth_weight} · tanh( clamp(change_7d, ${m.growth_floor}, ${m.growth_cap}) / ${m.growth_scale} )
maturity(age)    = ${m.maturity_floor} + ${(1 - m.maturity_floor).toFixed(2)} · (1 − e^(−age / ${m.maturity_tau_days}))</div>
      <p>The multiple is not invented. ${D.field.live_with_market_cap} protocols in this snapshot carry both a market cap and a TVL, so market cap per dollar of TVL is observable for them, and its median across the field is <b>${x(D.field.median_ratio)}</b>. Each category's own median becomes its anchor, shrunk toward that field median by ${m.anchor_prior_weight} pseudo-observations, and a category with fewer than ${m.anchor_min_members} live members is not a sample at all — it borrows the field median outright, so one outsized listing never becomes a multiple.</p>
      <p>Growth is bounded by tanh: a week that doubles TVL is worth at most ${growthHigh}, and a week that halves it at least ${growthLow}. Maturity credits age, never exceeds 1, and reaches ${x(m.maturity_floor + (1 - m.maturity_floor) * 0.63)} at one time constant. ${D.field.clamped_out} live protocols sit outside the clamp and were cut, not followed.</p>
    </div>
    <div class="card">
      <h2>The anchors, as the snapshot set them</h2>
      <p>Every category the board ranks, the live members whose median set its multiple, and the multiple it used. A category with fewer than ${m.anchor_min_members} live members falls back to the field median and says so in the last column.</p>
      <table class="mini"><thead><tr><th>Category</th><th class="num">live members</th><th class="num">their median</th><th class="num">anchor used</th><th class="num">pre-token rows</th><th>source</th></tr></thead><tbody>
      ${D.anchors.map((a) => `<tr><td>${esc(a.category)}</td><td class="num">${a.live_members}</td><td class="num">${a.median_ratio === null ? '—' : x(a.median_ratio)}</td><td class="num">${x(a.used_ratio)}</td><td class="num">${a.pre_token}</td><td class="src">${a.source === 'category' ? 'its own live members' : 'field median'}</td></tr>`).join('')}
      </tbody></table>
    </div>
    <div class="card">
      <h2>Farm plans, and why they read the way they do</h2>
      <p>Each row's plan is six steps: a wallet that holds only what you farm with, the one action that category counts, the weekly habit that keeps the position active across snapshots, the hold that gives the record time, the claim made only from the protocol's own site, and a log. The hold shortens as the protocol's own record lengthens; the gas in each step is priced by the chain the protocol runs on, not by a slogan.</p>
      <p>Launch pressure is a second, separate reading: how overdue a launch looks, from the days tracked and the seven-day change. It never changes the implied value; it tells a reader which protocol's silence is loudest.</p>
    </div>
  </div>`;
}

/* ---- routing ----------------------------------------------------------------------------------- */

function show(view) {
  for (const t of document.querySelectorAll('.tabs button')) t.classList.toggle('on', t.dataset.view === view);
  $('view-board').hidden = view !== 'board';
  $('view-live').hidden = view !== 'live';
  $('view-method').hidden = view !== 'method';
}

function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [head, ...rest] = h.split('/');
  if (head === 'live') { show('live'); closeDetail(); return; }
  if (head === 'method') { show('method'); closeDetail(); return; }
  if (head === 'p' && rest[0]) { show('board'); renderBoard(); openDetail(decodeURIComponent(rest.join('/'))); return; }
  if (head === 'filtered') {
    show('board');
    const cat = decodeURIComponent(rest.join('/'));
    state.cat = cat === 'all' ? '' : cat;
    $('cat').value = state.cat;
    renderBoard();
    closeDetail();
    return;
  }
  show('board');
  closeDetail();
}

for (const t of document.querySelectorAll('.tabs button')) t.onclick = () => { location.hash = `#/${t.dataset.view}`; };
$('q').oninput = (e) => { state.q = e.target.value; renderBoard(); };
$('cat').onchange = (e) => { state.cat = e.target.value; renderBoard(); };
$('chain').onchange = (e) => { state.chain = e.target.value; renderBoard(); };
$('sort').onchange = (e) => { state.sort = e.target.value; renderBoard(); };
$('watch').onchange = (e) => { state.watch = e.target.checked; renderBoard(); };
$('rows').onclick = (e) => {
  const tr = e.target.closest('tr[data-slug]');
  if (tr) location.hash = `#/p/${encodeURIComponent(tr.dataset.slug)}`;
};
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDetail(); });

renderBoard();
renderLive();
renderMethod();
route();
addEventListener('hashchange', route);
