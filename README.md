# Gloomhaven Deck Companion

An offline-first Gloomhaven Second Edition companion. The app makes no AI, analytics, or third-party runtime requests. Progress stays on the device you use.

## Use it on a phone

Open **https://blk-beard.github.io/mindthief-companion-source/** once while online, then install it from the browser:

- **iPhone/iPad:** Share → Add to Home Screen.
- **Android:** browser menu → Install app / Add to Home screen.

The app shell and assets you open are cached for offline use. To keep mobile data low, card artwork and reference images are cached as you view them, not downloaded all at once. Phone saves stay in that phone’s browser storage and do not sync to the PC.

## Use it on Windows without installing Node

The portable Windows package contains `Start Companion.cmd`, the app, and its Node runtime. Extract the package folder and double-click **Start Companion.cmd**. It runs on `http://127.0.0.1:5192/`. It uses one local server process plus your browser; close the command window to stop it. No Node installation, internet, account, or AI subscription is needed after download.

Campaign progress is saved in `work\campaign-data\campaign-state.json` beside the app, with a backup file. Keep the extracted folder together and back up that directory. The release archive is built without anyone’s campaign saves.

## Build locally

Requires Node.js 22 and npm. Run `npm ci`, then `npm run build`. The Windows standalone package is maintained separately under `outputs/Mindthief Companion` and includes the portable runtime.

The Pages workflow builds the same TypeScript app with the repository subpath and deploys it for mobile installation. Saves on Pages use the browser’s local storage; no campaign data is sent to GitHub.

## Footprint

- The installed PWA uses the browser process; it starts no background worker until the turn advisor is requested.
- The turn advisor runs one bounded worker on demand and terminates it when complete or cancelled.
- The service worker has no polling, downloads only same-origin files requested by the player, and limits its runtime asset cache to 240 entries.
- The Windows package uses one local Node server process. It binds only to loopback and does not make external requests.

## Contents

The app includes the supplied class and card catalogs, card artwork, condition symbols, build/equipment management, character progression, scenario tracking, resting, and the turn advisor. Items that lack reviewed effects are not inferred by the advisor.

Card and reference artwork remains owned by its creators. Symbols: Gloomhaven Secretariat (Lurkars/gloomhavensecretariat). Card artwork: cmlenius/gloomhaven-card-browser.
