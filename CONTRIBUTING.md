# Contributing to Slide Studio

Run commands below from the repository root. The current test and web-build scripts use Node.js built-ins; there are no npm packages to install. Use a current Node.js LTS release. Running the local editor also requires Python 3.9 or newer.

## Check a change

```sh
npm test
git diff --check
```

The test suite covers HTML import validation and file selection, editable PowerPoint output, the static deployment asset allowlist, and the offline tutorial and its translations. Import validation tests use a small parser stub; they do not replace testing import and rendering in a real browser.

For changes to **Present**, run `npm run test:browser` in an environment with Playwright and its Chromium browser available. This optional test starts a temporary loopback server and checks the local and online tutorials, rendered slides, keyboard navigation, the presentation CSP nonce, and feedback for pending source edits. Set `PLAYWRIGHT_MODULE` to an absolute Playwright module path if it is provided outside this checkout; `PLAYWRIGHT_CHROMIUM_EXECUTABLE` can select an existing Chromium executable. The default `npm test` command still requires no installed npm packages.

The web-build tests recreate `web-dist/`. That directory is generated output and is ignored by Git. Keep source changes in `slide-editor/`, `scripts/`, or the tutorial source rather than editing `web-dist/` directly.

## Try the editor locally

```sh
python3 slide-editor/server.py
```

Open <http://127.0.0.1:8765/> and keep the terminal running. Stop it with `Ctrl+C`. Use the built-in tutorial or a disposable deck to check visual changes. The local edition can save changes to deck files; it backs up the previous version under `.slide-editor-backups/`.

For browser-storage or folder-import changes, test the static web edition as well:

```sh
npm run build
python3 -m http.server 8766 --directory web-dist
```

Open <http://localhost:8766/>. This edition imports files in the browser and saves drafts to that browser's storage instead of writing to the original file. Check the affected flow, export the result, and reopen it to confirm the edits are retained.

## Update the built-in tutorial

1. Edit `examples/landing-page/index.html` or its image assets.
2. If lesson text changes, update its English and Japanese entries in `slide-editor/tutorial-language.js`.
3. Regenerate the offline tutorial, then run the tests:

```sh
node scripts/build-tutorial.mjs
npm test
```

Include the generated `slide-editor/tutorial.html` in the same change as the tutorial source. The generator embeds local JPEG images and the upstream MIT notice. Keep `examples/landing-page/LICENSE` intact. Rebuild the web edition after regeneration if you are previewing it there.

## Prepare a focused contribution

Describe the problem, what changed, and which checks you ran. For a visual change, include reproduction steps and before/after screenshots when useful. Check `git status --short` and the diff before committing so personal decks, exports, and unrelated work are not included.

For native macOS changes, follow the separate [Mac build instructions](desktop/macos/README.md). The [English user guide](docs/guide.md) and [中文使用指南](docs/guide.zh-CN.md) explain supported deck formats and current limitations.
