# WALLETS

Fly through five levels as your Rare Friend. A connected run spends 25 $RAREFRIENDS into that NFT's own wallet before the dive can start. Coins you burn during the run are simulated.

## What you do

1. Connect your wallet and pick a Friend you own. That NFT is you on screen.
2. Pay 25 RF. It goes into that Friend's own wallet and stays there. The dive does not start until the payment confirms. A paid dive gets 4 hits, 40 starting coins, and a longer phase. The stand-in gets 3 hits and 22 coins.
3. Steer and dodge. Pick up coins. Spend 1 simulated coin to phase so hazards pass through you.
4. Burn that level's quota to open the next one. There are five levels. Three hits ends the run.
5. Don't want to pay? Choose Stand-in. That run is free and the coins are pretend.

**Builder:** Steven Reynolds · [GitHub](https://github.com/stevereynolds2006-ship-it) · [@Sharpbigred](https://x.com/Sharpbigred)

**Category:** Token Activity (also Economy Potential)

**Stack:** FriendSDK v0.1.4 (`@rarefriends/friendsdk/game`, wallet, owned friends, and sprites) inside a Node 22 web app. The dive is a full-screen canvas, not the FriendSDK 960×640 sandbox frame. Connect a wallet and the diver is that Generations NFT. With no wallet, the diver is original geometric art. Burns go through the SDK preview client (`buy`, `play`, `settle`, `redeem`).

## Run it

Node.js 22+.

```sh
git clone https://github.com/stevereynolds2006-ship-it/wallets.git
cd wallets
npm ci
npm run dev
```

Open the printed URL (normally `http://127.0.0.1:8080`).

Burns stay simulated on the stand-in. Connect a wallet, pick a Friend, and tap Pay 25 RF. MetaMask sends 25 RF into that Friend's token-bound wallet. The dive does not start until that payment confirms. Then tap Dive. The coins stay there. The wallet stays closed while you play.

**Playable preview:** https://stevereynolds2006-ship-it.github.io/cinder-crew/wallets/

## Play

- Connect wallet, under the title, reads the Friends you hold. In the MetaMask browser it prompts that wallet. Anywhere else, the same button opens the MetaMask app. Pick a Friend, then Dive. That NFT's on-chain sprite is the diver. Disconnect wallet forgets that Friend on this page. It does not spend RF.
- Start with nothing selected dives as the stand-in, strata 01, RAIN, with 22 simulated RF.
- Steer with A and D, the arrow keys, the on-screen chevrons, or by dragging. A and the left chevron turn left.
- W or up boosts. S or down brakes.
- Space, K, or BURN phases you. It does not open the wallet. The stand-in spends 1 simulated RF. While phased, hazards pass through you and nearby RF is pulled in. A connected Friend pays 25 RF into that NFT's wallet before Dive unlocks.
- Reach the end of a stratum only after you have burned that stratum's quota. The seal then cracks and the next stratum starts. Five strata end at GARGANTUA.
- Three hits collapse the dive. Coins add RF to the pocket. A dry pocket refuses the next burn until you scoop more.
- Mute and reduced motion are on the menu. Escape pauses.

## Costs and rewards

**All balances, purchases, and returns are simulated.** Capsule price is 1 RF. You start with 22 RF. Expected return is 0.30 RF per capsule, so the expected sink is 0.70 RF. Chances sum to 10,000 basis points.

| Outcome | Chance | Comes back |
| --- | --- | --- |
| Ash | 55% | 0 RF |
| Cinder | 25% | 0 RF |
| Echo | 15% | 1 RF |
| Drip | 5% | 3 RF |

Strata burn quotas: RAIN 6, GRID 10, WAVE 14, TESSERACT 18, GARGANTUA 24.

FriendSDK v0.1.4 settles each capsule on a preview ledger with a shadow balance so the client can buy, play, settle, and redeem. The number on screen is the 22 RF stipend plus scooped coins, not that shadow balance. Those capsules never move RF. A connected dive is separate: 25 RF goes to that Friend's token-bound wallet before play.

## Checks and known limits

`node --experimental-strip-types --test src/game/sim.test.ts` — 7 tests, all passing (Ash sink, Drip redeem, empty-wallet refusal, A turns left, seal stays shut until the quota, strata 01 cracks after the quota, paid dive gets 4 hits and 40 coins). The static page build (`npm run pages`) succeeds.

- A connected dive sends 25 RF to that Friend's token-bound wallet before Dive unlocks. It stays there. The stand-in never sends RF.
- Connect reads ownership and the canonical Generations bitmap. Burns during play stay simulated.
- Without a wallet, the diver is original art.
- The stage fills the visible screen, including the MetaMask browser's fullscreen control.
- Best score and lifetime burn stay in this browser (`localStorage`).

## Credits

FriendSDK v0.1.4 from [spokesz/friendsdk](https://github.com/spokesz/friendsdk). SDK code is Apache-2.0. A connected diver uses that Friend's canonical Generations bitmap. Scenery, the stand-in, and tones are original.
