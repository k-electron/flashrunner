# FlashRunner

Sight-word flashcards for early readers. Pick a level, work through the words one at a time, and
the ones you miss come back until you clear them.

**[Try it →](https://flashrunner.pages.dev)**

No account, no sign-up, nothing to install. It runs entirely in the browser, and your progress
stays on the device.

## How it works

Two decks ship with it, both drawn from the Dolch sight word lists:

| Deck               | Words | Levels                         |
| ------------------ | ----- | ------------------------------ |
| Dolch Pre-K        | 40    | 8 (5, 10, 15 … 35, full deck)  |
| Dolch Kindergarten | 52    | 10 (5, 10, 15 … 45, full deck) |

Each level is the first _n_ words of the deck, so Level 2 contains Level 1's words plus five more.
Starting small and widening means an early reader meets a handful of words at a time instead of a
wall of fifty.

**A run** shows one word at a time. Mark each one **Got it** or **Not yet**:

- **Not yet** words come back in the next round.
- The level is cleared when a round ends with nothing left to bring back.
- Clearing a level unlocks the next one. Clearing the full deck is mastery.

Two thin bars along the top show how far you are through the current round and through the level.
There is also a **speaker button** that reads the word aloud, for when the adult helping isn't
sure of the pronunciation or isn't there.

Progress saves after every single card, so if you close the tab mid-run you come back to the exact
word you left on.

## What it does with your data

Nothing leaves your device. There is no server to send it to. FlashRunner is a static page, and
progress is written to your browser's own `localStorage` under keys starting with `flashrunner:`.

Which means:

- Progress is **per browser, per device**. Two children on one tablet share one set of progress;
  the same child on a phone and a laptop has two.
- Clearing site data, or using a private window, wipes it.
- There is no sync and no export.

## What it doesn't do

No accounts, no leaderboards, no streaks, no timers, no sounds beyond the word itself. It also
doesn't work offline yet, and the decks aren't editable from the interface. Adding one means
editing the source (see [CONTRIBUTING.md](CONTRIBUTING.md)).

## Running your own instance

You need **git** and **Node 26.7.0** (pinned in [`.nvmrc`](.nvmrc)).

```bash
git clone https://github.com/k-electron/flashrunner.git
cd flashrunner
nvm use          # skip if you already run 26.7.0
npm ci
npm run build    # writes dist/
```

`dist/` is a plain static site. Upload it anywhere that serves static files: Cloudflare Pages,
Netlify, GitHub Pages, S3, nginx.

It is a single-page app, so the host must serve `index.html` for paths
it doesn't recognise; otherwise a link straight to a level 404s on refresh. Most static hosts do
this automatically as long as the output has no top-level `404.html`, which is why the build
produces neither a `404.html` nor a `_redirects` file (CI fails if either appears).
If your host needs to be told explicitly, look for a "SPA fallback" or "rewrite to index.html"
setting.

To poke at it locally before deploying:

```bash
npm run dev      # http://localhost:5173, hot reload
npm run preview  # serves the built dist/ instead
```

## Browser support

Any current browser. The speaker button uses the browser's built-in speech synthesis, and if the
browser doesn't have it the button doesn't appear, and everything else works the same.

## License

Code is [MIT](LICENSE). The Dolch sight word lists were published in 1936 and are public domain.

The typeface is [Andika](https://software.sil.org/andika/) (SIL Open Font License), picked for one
reason: it draws a single-storey `a` and a single-bowl `g` with an open tail, the letter shapes
children are taught to read and write. Most typefaces use a double-storey `a`, which asks
a pre-reader to decode a shape nobody has shown them.
