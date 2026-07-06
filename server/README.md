# Stakes settlement backend

Operator-run service that settles a challenge on-chain: it reads the stake deposits,
returns each participant their **retained** NIM (+ an optional finisher bonus), and
**burns** the forfeited remainder to Nimiq's all-zero address. The settlement *rules*
are the same `computeSettlement` the app uses — single source of truth.

Transactions are built and signed **offline** with `@nimiq/core` and broadcast by POSTing
the raw signed hex to a node's `sendRawTransaction` over **HTTP JSON-RPC** (`client.ts` →
`rpc.ts`); no P2P connection is opened. The target network is set by `STAKES_NETWORK_ID`
(5 = testnet, the default; 24 = mainnet). Run it on a machine with normal network access.

## Prerequisites
`.env.local` (git-ignored) at the repo root with:
```
VITE_TREASURY_NIM_ADDRESS="NQ.. .."   # public treasury (custody) address
TREASURY_KEYPAIR_HEX=...               # treasury signing key (testnet only)
```
The treasury must hold enough NIM to cover finisher bonuses (the staked pool itself
is conserved: retained → participants, forfeited → burn).

## Commands
```bash
# 1. Sanity check: key loads + node reaches consensus
node --env-file=.env.local --import tsx server/check.ts

# 2. Settle a challenge from a plan file
node --env-file=.env.local --import tsx server/settle.ts server/plan.json
# or: npm run settle -- server/plan.json
```

## Plan file
See `plan.example.json`. `challengeId` is the id from the app (the `?c=<id>` / `?p=<id>`
value). `stake` is the challenge's per-person stake in NIM. `completion` is optional
(address → days done); any participant not listed defaults to a perfect week.

## Notes
- **Source of truth:** who staked + how much comes from on-chain deposits tagged
  `stakes:<challengeId>`; completion is honor-based and supplied in the plan.
- **Idempotent:** writes `server/.settled/<challengeId>.json` and refuses to settle the
  same challenge twice (delete that file to force a re-run).
- **Single-device demo caveat:** only wallets that actually deposited get paid. Seeded
  demo friends (Maya/Tom) never staked real NIM, so they won't appear in deposits.
