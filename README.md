# pre-token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/lhwnb/pre-token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/lhwnb/pre-token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A radar for protocols that record no token yet: every row answers one question — if this protocol's record
stayed exactly as the sealed snapshot finds it, what would its token be worth? The answer is a dollar figure
built only from three fields the snapshot itself carries (TVL, its seven-day change, how long the protocol has
run with no token recorded), ranked against every other pre-token protocol in the same snapshot, with a farm
plan for the ones on the house watchlist.

## The model, and why it is not a list

`implied = TVL × anchor(category) × growth(7d) × maturity(age)`

The multiple is read off the snapshot, never invented. 128 of the 416 live protocols carry both a market cap
and a TVL, so market cap per dollar of TVL is observable for them; its median across the field is 0.21. Each
category's own median becomes that category's anchor, shrunk toward the field median by 8 pseudo-observations,
and a category with fewer than 3 live members is not a sample at all — it borrows the field median outright,
so one outsized listing never becomes a multiple. Growth is bounded by tanh (a week that doubles TVL is worth
at most 1.55×, a week that halves it at least 0.45×), maturity credits age and never exceeds 1.

The board also refuses to count a wrapped, staked or bridged product as a protocol without a token: WBTC,
USDT0, a liquid staking receipt — 147 of the 342 pre-token records are products of a token that already
trades, and they are filtered out by category, name pattern and symbol, which leaves 196 rows ranked. The 40
house watchlist protocols are kept in even where a filter would touch them, so coverage never rests on a
filter's edge. Nothing is hardcoded: swap the snapshot and the anchors, ranks and farm plans all move.

## What is in the repository

| path | what it is |
| --- | --- |
| `main.ts` | the entrypoint the grader runs: reads the snapshot, writes the board, the data script, the dashboard and the dossier |
| `lib/model.ts` | the model above, in one file: anchors, growth, maturity, the product filter, launch pressure, farm plans |
| `dashboard/` | a static page, no framework and no network: ranking, category and chain filters, sort, a detail drawer per protocol, a method page |
| `screenshots/` | the board, a detail view, a filtered view and the method page, as rendered from this build |
| `vendor/makefun-board.ts` | the kit's vendored dossier writer, unmodified |

## Run it

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

Inside the grader the output directory is `/output` and the snapshot is `/input/snapshot.json`, so the same
command with no environment variable is what the harness runs. The program writes `board.json` (196 ranked
rows, rank 1..N, implied value non-increasing), `data.js` for the page, `dashboard/`, `screenshots/` and
`dossier.json`; two runs on the same snapshot produce byte-identical output.

---

<sub>Entered on [make.fun](https://make.fun/?ref=7d4kyrhq&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
