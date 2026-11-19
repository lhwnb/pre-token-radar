// The value model behind the radar (token-radar-01, model version radar-2).
//
// The claim the board makes is narrow and stated: what a token would be worth if the protocol's record
// stayed exactly as the snapshot finds it. The record is three numbers —TVL, its seven-day change, and
// how long the protocol has run with no token —and the model turns them into one dollar figure.
//
// The multiple is not invented here. The snapshot carries 416 protocols whose token already trades, and
// for 129 of them it carries both a market cap and a TVL, so the ratio market-cap / TVL is observable.
// That ratio is what a live token of the same category is worth per dollar of TVL, and the model reads it
// from the snapshot itself: per category when the category has live members, shrunk toward the whole
// field's median when it has only a few, so one outsized listing cannot become a category's multiple.
//
//   implied value = TVL x anchor(category) x growth(7d) x maturity(age)
//
// growth() is bounded: a protocol whose TVL doubled in a week is not worth 2x, and one that halved is not
// worth 0. maturity() credits age —a protocol that has held its TVL for years has a record a young one
// does not —and never rises above 1. Every constant below is named, printed on the dashboard and quoted
// in the entry's readme, so a reader can disagree with a number and see where it came from.

/** A protocol as the sealed snapshot carries it: exactly ten fields, nothing derived. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The snapshot: the protocols, the house watchlist, and the floor the watchlist was cut at. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** Every constant the model uses. The dashboard prints this object, so the page and the board agree. */
export interface ModelConstants {
  /** Pseudo-observations of the field's median ratio added to each category's own sample. */
  anchor_prior_weight: number;
  /** Live members a category needs before its own median is a sample rather than an anecdote. */
  anchor_min_members: number;
  /** The anchor is clamped: a category of two listings cannot claim a 19x multiple. */
  anchor_min_ratio: number;
  anchor_max_ratio: number;
  /** tanh scale on the seven-day change: +22% of TVL change is one "unit" of growth. */
  growth_scale: number;
  /** How much of that unit the value follows: 0.55 at the bound, so growth spans 0.45x to 1.55x. */
  growth_weight: number;
  /** The snapshot's change_7d is clamped before it is used, in per cent. */
  growth_floor: number;
  growth_cap: number;
  /** Maturity: 0.45 at age zero, approaching 1 with a 420-day time constant. */
  maturity_floor: number;
  maturity_tau_days: number;
  /** A protocol with no listing date is modelled as this old, and the row says so. */
  unknown_age_days: number;
  /** Launch pressure: zero at 180 days without a token, full at 1,080. */
  pressure_start_days: number;
  pressure_full_days: number;
}

export const MODEL: ModelConstants = {
  anchor_prior_weight: 8,
  anchor_min_members: 3,
  anchor_min_ratio: 0.03,
  anchor_max_ratio: 1.5,
  growth_scale: 22,
  growth_weight: 0.55,
  growth_floor: -60,
  growth_cap: 150,
  maturity_floor: 0.45,
  maturity_tau_days: 420,
  unknown_age_days: 365,
  pressure_start_days: 180,
  pressure_full_days: 1080,
};

/** The model's version label: the dashboard names it and the entry's readme quotes it. */
export const MODEL_VERSION = 'radar-2';

/** A farm step: what to do, what it costs, how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json. Extra keys are allowed by the gate, so the row carries its own working. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  on_watchlist: boolean;
  anchor: Anchor;
  launch_pressure: number;
  risk_flags: string[];
  model: {
    anchor_ratio: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** How one protocol's multiple was set: the category's own sample, or the field's median. */
export interface Anchor {
  category: string;
  /** Live protocols in this category that carried both a market cap and a TVL. */
  live_members: number;
  /** Their median market cap per dollar of TVL, or null when the category has no live member. */
  category_median: number | null;
  /** The multiple the board used, after shrinkage toward the field's median and the clamp. */
  ratio: number;
  /** 'category' when the category's own sample set it, 'field' when only the median could. */
  source: 'category' | 'field';
}

/** One category's line on the dashboard's anchor table. */
export interface CategoryAnchor {
  category: string;
  live_members: number;
  median_ratio: number | null;
  used_ratio: number;
  source: 'category' | 'field';
  /** Pre-token protocols in the snapshot that carry this category. */
  pre_token: number;
}

/** The whole field's anchor: the median market cap per dollar of TVL among live protocols. */
export interface FieldAnchor {
  live_with_market_cap: number;
  median_ratio: number;
  /** The live protocols whose own ratio sits above the clamp, named so the page can show its cutting. */
  clamped_out: number;
}

/** A board row as the page reads it: the row's numbers, without its prose. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  age_days: number | null;
  listed_at: string | null;
  implied_value_usd: number;
  on_watchlist: boolean;
  anchor_ratio: number;
  anchor_source: 'category' | 'field';
  anchor_members: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  launch_pressure: number;
  risk_flags: string[];
  farm_steps: FarmStep[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  /** Its own market cap per dollar of TVL: the evidence the anchors are built from. */
  ratio: number | null;
}

/** Everything the dashboard needs: the board, the evidence behind its multiples, and the live set. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  protocols_scanned: number;
  pre_token_count: number;
  /** Pre-token protocols that are a wrapped, staked or bridged product: the board ranks none of them. */
  product_count: number;
  watchlist_size: number;
  board_size: number;
  live_size: number;
  field: FieldAnchor;
  anchors: CategoryAnchor[];
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Keep `x` inside [lo, hi]. */
function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/** The median of a non-empty list of numbers, by sorted position. */
export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A whole word that marks a product of a protocol rather than one: WBTC is wrapped, stETH is staked. */
const PRODUCT_WORD = /\b(wrapped|staked|staking|restaked|bridged|liquid staking)\b/i;

/** An exchange's own name opens a product of the exchange, not a launch of its own. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)/i;

/** A stablecoin's bridged or versioned form: USDT0 is USDT on another chain, not a new protocol. */
const STABLE_WRAPPER = /^(USDT|USDC|DAI|FDUSD|TUSD|USDe|USDS|PYUSD|GHO|FRAX|USDD|LUSD|crvUSD)/i;

/** Categories that are, by construction, a product of a protocol whose token already trades. */
const PRODUCT_CATEGORIES = new Set([
  'CEX',
  'Bridge',
  'Canonical Bridge',
  'Cross Chain Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
]);

/** Whether a protocol records no token at all —the snapshot's own words, never "it has none". */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is a wrapped, staked or bridged product of one whose token already trades. */
export function isProduct(p: SnapshotProtocol): boolean {
  if (PRODUCT_CATEGORIES.has(p.category ?? '')) return true;
  if (VERSIONED.test(p.name)) return true;
  if (EXCHANGE_PREFIX.test(p.name)) return true;
  if (PRODUCT_WORD.test(p.name)) return true;
  return STABLE_WRAPPER.test(p.name);
}

/** Whether a protocol belongs on the board: records no token, and is a protocol rather than a product. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && !isProduct(p);
}

/** A live protocol's market cap per dollar of TVL, or null when either figure is missing or zero. */
export function marketPerTvl(p: SnapshotProtocol): number | null {
  if (!(finite(p.mcap_usd, 0) > 0) || !(p.tvl_usd > 0)) return null;
  return p.mcap_usd! / p.tvl_usd;
}

/** The field's anchor: the median ratio of every live protocol that carries both figures. */
export function fieldAnchor(protocols: SnapshotProtocol[]): FieldAnchor {
  const ratios: number[] = [];
  let withCap = 0;
  for (const p of protocols) {
    if (isPreToken(p)) continue;
    if (!(finite(p.mcap_usd, 0) > 0)) continue;
    withCap += 1;
    const r = marketPerTvl(p);
    if (r !== null && Number.isFinite(r) && r > 0) ratios.push(r);
  }
  const raw = ratios.length > 0 ? median(ratios) : 0.2;
  return {
    live_with_market_cap: withCap,
    median_ratio: round4(raw),
    clamped_out: ratios.filter((r) => r < MODEL.anchor_min_ratio || r > MODEL.anchor_max_ratio).length,
  };
}

/** How a category's multiple is set: its own live members' median, shrunk toward the field's median. */
export function categoryAnchors(protocols: SnapshotProtocol[], field: FieldAnchor, model: ModelConstants = MODEL): Map<string, Anchor> {
  const samples = new Map<string, number[]>();
  for (const p of protocols) {
    const r = marketPerTvl(p);
    if (r === null || !Number.isFinite(r) || r <= 0) continue;
    const key = p.category ?? '(none)';
    const list = samples.get(key);
    if (list === undefined) samples.set(key, [r]);
    else list.push(r);
  }
  const out = new Map<string, Anchor>();
  for (const [category, ratios] of samples) {
    const own = median(ratios);
    // Fewer members than the minimum is an anecdote, not a sample: the field's median carries the category.
    const thin = ratios.length < model.anchor_min_members;
    const shrunk = thin
      ? field.median_ratio
      : (ratios.length * own + model.anchor_prior_weight * field.median_ratio) / (ratios.length + model.anchor_prior_weight);
    out.set(category, {
      category,
      live_members: ratios.length,
      category_median: round4(own),
      ratio: round4(clamp(shrunk, model.anchor_min_ratio, model.anchor_max_ratio)),
      source: thin ? 'field' : 'category',
    });
  }
  return out;
}

/** The anchor a protocol gets: its category's, or the field's when the category has no live member. */
export function anchorFor(p: SnapshotProtocol, anchors: Map<string, Anchor>, field: FieldAnchor): Anchor {
  const known = anchors.get(p.category ?? '(none)');
  if (known !== undefined) return known;
  return {
    category: p.category ?? '(none)',
    live_members: 0,
    category_median: null,
    ratio: round4(clamp(field.median_ratio, MODEL.anchor_min_ratio, MODEL.anchor_max_ratio)),
    source: 'field',
  };
}

/** The growth multiplier: bounded by tanh, so a doubling week is worth at most 1.55x and a halving 0.45x. */
export function growthMultiplier(change7d: number | null, model: ModelConstants = MODEL): { pct: number; multiplier: number } {
  const raw = finite(change7d, 0);
  const pct = clamp(raw, model.growth_floor, model.growth_cap);
  return { pct, multiplier: round4(1 + model.growth_weight * Math.tanh(pct / model.growth_scale)) };
}

/** The maturity multiplier: age credits a record, from `maturity_floor` at zero toward 1. */
export function maturityMultiplier(age: number | null, model: ModelConstants = MODEL): number {
  const days = Math.max(0, age ?? model.unknown_age_days);
  return round4(model.maturity_floor + (1 - model.maturity_floor) * (1 - Math.exp(-days / model.maturity_tau_days)));
}

/** The three multipliers and the dollar figure one protocol gets. */
export function impliedValue(p: SnapshotProtocol, asOf: string, anchor: Anchor, model: ModelConstants = MODEL): {
  implied: number;
  age: number | null;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
} {
  const age = ageDays(asOf, p.listed_at);
  const growth = growthMultiplier(p.change_7d, model);
  const maturityMult = maturityMultiplier(age, model);
  const implied = Math.max(1, Math.round(p.tvl_usd * anchor.ratio * growth.multiplier * maturityMult));
  return { implied, age, growthPct: growth.pct, growthMult: growth.multiplier, maturityMult };
}

/** How overdue a launch looks: days without a token, tempered by the seven-day change. Zero to 100. */
export function launchPressure(age: number | null, change7d: number | null, model: ModelConstants = MODEL): number {
  const days = Math.max(0, age ?? model.unknown_age_days);
  const agePart = clamp((days - model.pressure_start_days) / (model.pressure_full_days - model.pressure_start_days), 0, 1);
  const growthPart = clamp(finite(change7d, 0) / 60, 0, 1);
  return Math.round(100 * (0.65 * agePart + 0.35 * growthPart));
}

/** The flags a reader should see before farming a protocol. Two at most, so a row stays readable. */
export function riskFlags(p: SnapshotProtocol, age: number | null, floorUsd: number): string[] {
  const flags: string[] = [];
  if (p.tvl_usd < floorUsd) flags.push('below the house floor');
  if (age === null) flags.push('no listing date recorded');
  if (age !== null && age < 90) flags.push('under 90 days tracked');
  if (p.change_7d === null) flags.push('no 7d change reported');
  else if (p.change_7d < -20) flags.push('TVL down more than 20% this week');
  if (p.chains.length === 0) flags.push('no chain recorded');
  return flags.slice(0, 2);
}

/** Round to four decimals, so the printed constant and the computed one read the same. */
function round4(x: number): number {
  return Math.round(x * 10_000) / 10_000;
}

/** US dollars, compact: $4.2M, $912k, $8.1B. */
export function money(usd: number): string {
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(usd >= 1e10 ? 0 : 1)}B`;
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(usd >= 1e8 ? 0 : 1)}M`;
  if (usd >= 1e3) return `$${Math.round(usd / 1e3)}k`;
  return `$${Math.round(usd)}`;
}

/** Gas on a chain, as a farm step's cost sentence: a deposit on Ethereum is not a deposit on Solana. */
export function gasCost(chains: string[]): string {
  const first = chains[0] ?? 'the chain';
  if (/^Ethereum/i.test(first)) return 'about $6 of gas on Ethereum';
  if (/^(Base|Arbitrum|Optimism|Polygon|Sonic|Unichain|Berachain|Plume|Mantle|Linea|Scroll)/i.test(first)) return 'under $0.50 of gas';
  if (/^(Solana|Sui|Aptos|Near)/i.test(first)) return 'under $0.05 of gas';
  if (/^(Bitcoin|BSquared|Stacks)/i.test(first)) return 'about $2 of gas plus the bridge fee';
  return 'about $1 of gas';
}

/** The action a category's farm plan opens with: what farming that protocol actually is. */
export function categoryAction(category: string | null): { make: (name: string, chain: string) => string; counts: string } {
  switch ((category ?? '').toLowerCase()) {
    case 'lending':
      return { make: (n, c) => `Supply $50 of USDC to ${n} on ${c} and keep the receipt token.`, counts: 'a supply, a borrow or a repayment' };
    case 'cdp':
      return { make: (n, c) => `Open a vault on ${n} (${c}) with $50 of USDC and mint the protocol's own asset against it.`, counts: 'a vault action, a repayment or a mint' };
    case 'dexs':
      return { make: (n, c) => `Provide $50 of liquidity to a narrow USDC pair on ${n} (${c}) and keep the LP position.`, counts: 'a swap, a deposit or a fee claim' };
    case 'liquid staking':
    case 'liquid restaking':
    case 'restaking':
      return { make: (n, c) => `Stake $50 of the staking asset that ${c} uses through ${n} and keep the receipt token.`, counts: 'a stake, an unstake request or a restake' };
    case 'bridge':
    case 'canonical bridge':
    case 'cross chain bridge':
      return { make: (n, c) => `Bridge $50 of USDC through ${n} onto ${c} and use the funds in the app on the far side.`, counts: 'a bridge, a return bridge or an app action' };
    case 'yield':
    case 'yield aggregator':
    case 'leveraged farming':
    case 'farm':
      return { make: (n, c) => `Deposit $50 of USDC into the most-audited vault on ${n} (${c}) and keep the shares.`, counts: 'a deposit, a harvest or a withdrawal-and-redeposit' };
    case 'derivatives':
    case 'perps':
      return { make: (n, c) => `Deposit $50 of USDC as margin on ${n} (${c}) and open one small hedge.`, counts: 'a trade, a margin change or a settlement' };
    case 'rwa':
      return { make: (n, c) => `Mint $50 of the yield asset ${n} issues on ${c} and hold it.`, counts: 'a mint, a redemption or a transfer' };
    case 'basis trading':
      return { make: (n, c) => `Deposit $50 of USDC into the basis strategy on ${n} (${c}) and keep the position.`, counts: 'a deposit or a rebalance' };
    case 'indexes':
      return { make: (n, c) => `Mint $50 of the index token ${n} issues on ${c} and hold it through one rebalance.`, counts: 'a mint, a redemption or a rebalance' };
    case 'privacy':
      return { make: (n, c) => `Deposit $50 into ${n} on ${c} and move it once through the pool.`, counts: 'a deposit and a withdrawal' };
    case 'ai agents':
      return { make: (n, c) => `Stake $50 of the asset an agent needs on ${n} (${c}) and run one task.`, counts: 'a stake or an agent task' };
    case 'payments':
      return { make: (n, c) => `Send one small payment through ${n} on ${c} and keep the receipt.`, counts: 'a payment or a settlement' };
    case 'chain':
      return { make: (n, c) => `Bridge $50 onto ${n} through ${c} and use its main app once.`, counts: 'a bridge, a swap or a contract call' };
    case 'risk curators':
    case 'onchain capital allocator':
      return { make: (n, c) => `Deposit $50 of USDC into a vault ${n} curates on ${c} and keep the shares.`, counts: 'a deposit or a vault migration' };
    case 'liquidity manager':
      return { make: (n, c) => `Open $50 of one managed LP position on ${n} (${c}) and keep it in range.`, counts: 'a position open or a rebalance' };
    case 'token locker':
      return { make: (n, c) => `Lock $50 on ${n} (${c}) for the shortest term the app allows.`, counts: 'a lock or a claim' };
    case 'staking pool':
      return { make: (n, c) => `Delegate $50 to a pool on ${n} (${c}) and keep the receipt.`, counts: 'a delegate or a redelegate' };
    case 'prediction market':
      return { make: (n, c) => `Buy $50 of a long-dated position on ${n} (${c}) and hold it to resolution.`, counts: 'a position open or a claim' };
    default:
      return { make: (n, c) => `Use the main app of ${n} on ${c} with $50 and keep the position open.`, counts: 'any qualifying action the app counts' };
  }
}

/** One sentence, ready to print: what a reader actually does on this protocol, with this size of position. */
export function actionSentence(category: string | null, name: string, chain: string): string {
  return categoryAction(category).make(name, chain);
}

/** How long a position should be held, given how young the protocol is: young records need longer proof. */
export function holdDays(age: number | null): number {
  const days = age ?? 365;
  if (days < 180) return 60;
  if (days < 540) return 45;
  return 30;
}

/** Six concrete steps for one protocol: fresh wallet, the action, the weekly habit, the hold, the claim, the log. */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const action = categoryAction(p.category);
  const gas = gasCost(p.chains);
  const hold = holdDays(age);
  const tvl = money(p.tvl_usd);
  return [
    {
      text: `Use a wallet that holds only what you farm with and keep its seed phrase offline; never reuse the wallet you hold savings in.`,
      cost: 'nothing but the wallet',
      time: '5 minutes',
    },
    {
      text: actionSentence(p.category, p.name, p.chains[0] ?? 'its main chain'),
      cost: `$50 of capital and ${gas}`,
      time: '15 minutes',
    },
    {
      text: `Repeat one qualifying action each week: ${action.counts}, so the position shows activity in more than one weekly snapshot.`,
      cost: 'about $2 a week in gas',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days before you touch it: ${p.name} has run ${age === null ? 'an unrecorded time' : `${age} days`} without a token and carries ${tvl} of TVL, so the record is what you are farming.`,
      cost: `the $50 stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Claim only from the protocol's own points or rewards page, reached from its official site: no legitimate claim asks for a seed phrase or a payment.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log, so you can repeat the position on the next protocol or unwind this one without guessing.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The board: every protocol that records no token, ranked by the model's implied value. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  const field = fieldAnchor(snapshot.protocols);
  const anchors = categoryAnchors(snapshot.protocols, field, model);

  // The watchlist is the floor and every slug of it is ranked even if the record were missing; the early
  // radar adds every other protocol that records no token, so the board is the whole pre-token field.
  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  for (const p of snapshot.protocols) if (isRankable(p)) chosen.set(p.slug, p);

  const watch = new Set(snapshot.watchlist);
  const scored = [...chosen.values()].map((p) => {
    const anchor = anchorFor(p, anchors, field);
    const v = impliedValue(p, snapshot.as_of, anchor, model);
    return { p, anchor, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));

  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token' as const,
    age_days: s.age,
    implied_value_usd: s.implied,
    on_watchlist: watch.has(s.p.slug),
    anchor: s.anchor,
    launch_pressure: launchPressure(s.age, s.p.change_7d, model),
    risk_flags: riskFlags(s.p, s.age, snapshot.floor_usd),
    model: {
      anchor_ratio: s.anchor.ratio,
      growth_pct: s.growthPct,
      growth_multiplier: s.growthMult,
      maturity_multiplier: s.maturityMult,
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map((step) => `${step.text} Cost: ${step.cost}. Time: ${step.time}.`),
  }));
}

/** The live-token set: the protocols the board deliberately does not rank, with the ratio it learned from them. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p))
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      ratio: marketPerTvl(p) === null ? null : round4(marketPerTvl(p)!),
    }))
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0));
}

/** One board row, as the page reads it. */
export function radarRow(row: BoardRow): RadarRow {
  const steps: FarmStep[] = row.farm_steps.map((text) => {
    const m = /^(.*) Cost: (.*)\. Time: (.*)\.$/.exec(text);
    return m === null ? { text, cost: '', time: '' } : { text: m[1]!, cost: m[2]!, time: m[3]! };
  });
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    age_days: row.age_days,
    listed_at: row.listed_at,
    implied_value_usd: row.implied_value_usd,
    on_watchlist: row.on_watchlist,
    anchor_ratio: row.anchor.ratio,
    anchor_source: row.anchor.source,
    anchor_members: row.anchor.live_members,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    launch_pressure: row.launch_pressure,
    risk_flags: row.risk_flags,
    farm_steps: steps,
  };
}

/** The board, the live set and every figure behind the multiples: what the page and the dossier show. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const field = fieldAnchor(snapshot.protocols);
  const anchors = categoryAnchors(snapshot.protocols, field, model);
  const preByCategory = new Map<string, number>();
  for (const p of snapshot.protocols) {
    if (!isRankable(p)) continue;
    const key = p.category ?? '(none)';
    preByCategory.set(key, (preByCategory.get(key) ?? 0) + 1);
  }
  const anchorTable: CategoryAnchor[] = [...anchors.values()]
    .map((a) => ({
      category: a.category,
      live_members: a.live_members,
      median_ratio: a.category_median,
      used_ratio: a.ratio,
      source: a.source,
      pre_token: preByCategory.get(a.category) ?? 0,
    }))
    .sort((a, b) => b.live_members - a.live_members || b.used_ratio - a.used_ratio);

  const live = liveRows(snapshot);
  return {
    board,
    radar: {
      as_of: snapshot.as_of,
      source: snapshot.source,
      floor_usd: snapshot.floor_usd,
      model,
      model_version: MODEL_VERSION,
      protocols_scanned: snapshot.protocols.length,
      pre_token_count: snapshot.protocols.filter(isPreToken).length,
      product_count: snapshot.protocols.filter((p) => isPreToken(p) && isProduct(p)).length,
      watchlist_size: snapshot.watchlist.length,
      board_size: board.length,
      live_size: live.length,
      field,
      anchors: anchorTable,
      rows: board.map(radarRow),
      live: live.slice(0, 120),
    },
  };
}

/** Read the sealed snapshot, refusing one this model cannot score. */
export function parseSnapshot(text: string): Snapshot {
  const raw = JSON.parse(text) as Partial<Snapshot>;
  if (typeof raw.as_of !== 'string' || !Array.isArray(raw.protocols) || !Array.isArray(raw.watchlist)) {
    throw new SnapshotError('the snapshot has no as_of, protocols and watchlist');
  }
  return {
    as_of: raw.as_of,
    source: typeof raw.source === 'string' ? raw.source : '',
    floor_usd: typeof raw.floor_usd === 'number' ? raw.floor_usd : 50_000_000,
    protocols: raw.protocols as SnapshotProtocol[],
    watchlist: raw.watchlist as string[],
  };
}

/** The gate's own conditions, checked before the board is written: the first problem, or null. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100) return `the board holds ${board.length} rows and the gate wants at least 100`;
  if (board.length > 4000) return `the board holds ${board.length} rows and the gate wants at most 4000`;
  const slugs = new Set(snapshot.protocols.map((p) => p.slug));
  const seen = new Set<string>();
  for (const row of board) {
    if (!slugs.has(row.slug)) return `row ${row.rank} names a slug the snapshot does not carry: ${row.slug}`;
    if (seen.has(row.slug)) return `row ${row.rank} repeats the slug ${row.slug}`;
    seen.add(row.slug);
    if (!(row.implied_value_usd > 0)) return `row ${row.rank} has no positive implied value`;
    if (row.farm_steps.length < 3 || row.farm_steps.length > 12) return `row ${row.rank} has ${row.farm_steps.length} farm steps`;
    for (const step of row.farm_steps) {
      const len = step.trim().length;
      if (len < 20 || len > 600) return `row ${row.rank} has a farm step of ${len} characters`;
    }
  }
  for (let i = 1; i < board.length; i += 1) {
    if (!(board[i - 1]!.implied_value_usd >= board[i]!.implied_value_usd)) return `the board is not sorted by value at row ${i + 1}`;
  }
  const values = new Set(board.map((r) => r.implied_value_usd));
  if (board.length >= 2 && values.size === 1) return 'every implied value is the same';
  for (const slug of snapshot.watchlist) if (!seen.has(slug)) return `the watchlist slug ${slug} is not on the board`;
  return null;
}

/** The dashboard's data file: one assignment of plain JSON, so the page needs no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR = ${JSON.stringify(radar)};\n`;
}
