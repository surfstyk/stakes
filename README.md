# Stakes

![Stakes — Win your moment. Bank the day.](public/brand/stakes-banner-2x1.png)

> **Win your moment. Bank the day.**

**Stakes** is a social commitment game built as a [Nimiq Pay](https://www.nimiq.com/nimiq-pay/) Mini App. You put a small amount of NIM on one personal goal, keep it every day for a week, and get it all back — plus a little NIM — when you follow through. Miss a day and that day's slice is gone. What keeps you honest is people, not surveillance: your word and the friends who see it, never activity tracking or an AI watching you.

Built for the **[Nimiq Mini Apps Competition](https://miniappscompetition.com/)**, Cycle II. Live on **mainnet** at **[app.stakes.day](https://app.stakes.day)** (open inside Nimiq Pay) · **[▶ demo](https://www.youtube.com/watch?v=ptgumWH57r4)** · **[📖 the story](https://blog.surfstyk.com/the-key-i-left-in-2021/)**.

<p align="center">
  <img src="public/screens/stakes-screen-1-pick.png" width="22%" alt="Pick your one thing">
  <img src="public/screens/stakes-screen-2-stake.png" width="22%" alt="Put a little money on your word">
  <img src="public/screens/stakes-screen-3-day.png" width="22%" alt="Make the day">
  <img src="public/screens/stakes-screen-4-banked.png" width="22%" alt="Bank the week">
</p>

## The idea
- *The money's job is to be **at risk**, not to be **won**.* The stake is working capital for your willpower.
- *Trust, not surveillance.* The app can't tell whether you actually went for the run. You give your word and check in; the people around you keep it real. No activity tracking and no AI watching you.
- *A mark on the chain.* Every check-in writes a small tagged stamp to the Nimiq blockchain, so your streak leaves real public evidence instead of a private row in our database.

## How it works
1. **Pick your one thing** and start. The first day is free and begins the moment you tap.
2. **Make it official.** Back your word with a little NIM, for a few days up to a month. Your first day is already on the clock, so it counts.
3. **Make the day.** Check in once a day, every day. Each check-in stamps the chain. Miss the day's window and that day's slice is forfeited.
4. **Bank it.** Finish and your stake comes back, with a small NIM completion bonus on top.

## The money
Stakes are real NIM, moved inside Nimiq Pay. In this **Cycle-II build the money layer is custodial**: you deposit your stake to a Stakes-run treasury, and payouts are settled automatically when the challenge ends. It sits behind a swappable `StakeVault` interface (`src/vault/`) so a **trustless on-chain escrow (USDT) can slot in later** without changing the product. The settlement math is a single pure function (`src/vault/settlement.ts`) shared by the app and the settlement job, so the preview you see and the on-chain payout can't diverge. There is **no game of chance** — every outcome is determined purely by who checked in.

## Architecture
- **Front end** — a Vite + React single-page app that runs inside the Nimiq Pay WebView, talking to the wallet over [`@nimiq/mini-app-sdk`](https://nimiq.dev/mini-apps/) for accounts, NIM payments, and the on-chain check-in stamps. All brand copy and theme are centralized in `src/brand/`.
- **API** — a small, dependency-free Node service (`node:http` + `node:sqlite`) in `server/` that stores challenges and check-ins. It binds to loopback and sits behind a reverse proxy in production.
- **Settlement** — an offline operator job (`server/settle.ts`) that reads the on-chain stake deposits, signs the payout transfers, and broadcasts them over JSON-RPC. The treasury signing key stays on that offline machine and never touches the internet-facing box.

## Run it locally
Requires **Node ≥ 22** (the API uses the built-in `node:sqlite`).

```bash
npm install
npm run api    # local API on http://127.0.0.1:8787 (SQLite at server/stakes.db)
npm run dev    # the SPA via Vite (proxies /api to the local API)
```

Open the printed URL. With no treasury address configured, the app uses a **mock money layer**, so the whole start → stake → check-in → bank loop runs in a plain browser with no real funds.

Append **`?test`** to the URL for a fast clock (3-minute "days") to run a full challenge in minutes. `?test` and the `?recon` dual-chain diagnostics are **dev-only** and compiled out of the public build.

## Build

```bash
npm run build         # dev / testnet build — keeps the ?test and ?recon dev tools
npm run build:public  # submission build — dev tools stripped and tree-shaken out
```

The deployed site is the output of `build:public` (`dist/`), served as a static SPA.

## License
[MIT](./LICENSE) © 2026 Hendrik Bondzio.
