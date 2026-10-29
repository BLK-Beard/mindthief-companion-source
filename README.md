# Gloomhaven Deck Companion

A responsive React + TypeScript web app starter for Gloomhaven Second Edition. It is designed for phone browsers as well as desktop screens.

## Run it

Install Node.js, then from this directory run:

```sh
npm install
npm run dev
```

Open the local URL shown by Vite. To test on a phone, connect the phone and computer to the same network and start Vite with `npm run dev -- --host`.

## Current prototype

- **Deck Lab:** responsive card browser with level, initiative, effect, and Augment filters; sort by initiative, known attack/move/heal values, experience, or data coverage. Nonnumeric/unknown action values remain last instead of being treated as zero. Class JSON fixes the hand size and the builder enforces it. Card art is lazy-loaded from the image paths referenced by the catalogs
- **Character sheet:** create, rename, and delete any character; track cumulative XP, derived level, max/current HP, gold, checkmarks, notes, personal quest, and retirement status
- **Reference tab:** combines each class’s mat notes crop with quick-reference definitions for Poison, Wound, Immobilize, Disarm, Stun, Muddle, Curse, Shield, Retaliate, Push, Pull, Pierce, Invisible, Strengthen, and Bless.
- **Deck analysis:** initiative-band mix, possible two-card initiative pairs, fast-pair coverage, Augment and Lost-action counts, status/effect tags, and visible action-data coverage
- **Analysis policy guide:** available from the Analysis tab or the Deck Lab’s “Open Deck Analysis & Policy” button. It explains how to record a real deck’s turns and describes the planned greedy, exact-optimizer, encounter, and calibration engines. The policy simulators are not implemented yet; the guide labels that clearly and reports action-tree readiness.
- **Play:** two-card turn selection, chosen initiative, action order, XP, element board, hand/discard/active/round-bonus/lost piles, and active-card dismissal
- Saved decks can be edited in place. Changing a deck’s card list clears its old turn history so new analytics stay tied to the current build.
- XP thresholds in each class JSON derive level automatically (0, 45, 95, 150, 210, 275, 345, 420, 500). Retired profiles remain as archives; retirement requires the player to confirm the personal-quest section directs it during City Phase Downtime. New characters gain one perk mark per previous retirement.
- **Rest timing:** short rest randomly reveals a discard card to lose, with the rules’ once-per-rest 1-damage redraw; long rest is declared instead of playing cards and resolves at initiative 99. Health stays in sync with scenario damage and long-rest healing; max HP derives from the character’s class and level.
- Saved characters, decks, selections, and scenario state are stored in browser local storage
- The 18 supplied per-character JSON files in `src/data/` remain the source of truth for class and card catalogs. When card data is changed, keep the supplied source files synchronized. Mat artwork is split into portrait-background and class-notes crops in `public/character-art/`.
- Each ability card now has an `analysisModel` for both halves, with normalized half stats, typed action/effect nodes, card-flow fields, and element rules. Nodes keep `sequence: null` and `relationship: "unresolved"` until their ordering and parent/child links are reviewed from the card. Thus the model records known facts without pretending that flat data is a complete ability tree. `reviewStatus` is `unreviewed`, `partial`, or `complete`; currently only 80 cards contain partial action data and no card is complete. A colored element badge marked with `!` is indexed as generated; an element in the gray capsule with a red X is indexed as consumed. If a consumed element is unavailable, skip only its linked effect and continue resolving the rest of the action. `null` means the printed action still needs review; after verifying a side, set `indexed` to `true` and use empty arrays for categories that are absent. Keep the matching supplied source JSON in `can/outputs/gh2-characters` synchronized with `src/data/`.
- Each class JSON includes the fixed hand size printed on its character mat. The Deck Lab prevents selecting more cards than the class permits and saves only complete hands.
- Active non-Lost cards remain active through a rest. They count toward long-rest eligibility and can be selected as the card to lose, but are not returned to hand by resting. Dismiss an active card to its marked pile before a rest if you want a non-Lost card to be recoverable from discard.
