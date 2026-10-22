# Slide Studio — HTML Slide Editor

[English](README.md) · [简体中文](README.zh-CN.md)

A local visual editor for HTML slide decks. Edit text directly on a slide, move elements, adjust styles, and jump to the corresponding HTML source. Saved files remain ordinary HTML that you or an AI coding assistant can continue editing.

The editor UI supports **English, 日本語, and 中文**, available from the globe menu in the top-right corner, with your language preference remembered in the browser. Slide content is not translated.

## Mac desktop app

A native macOS app is available as a local build: double-click **Slide Studio.app**, then choose an HTML file or folder. No Python, Node.js, or terminal is required for the packaged app. See [macOS setup and build notes](desktop/macos/README.md).

```sh
./desktop/macos/build.sh
```

Build output: `dist/Slide Studio.app` and `dist/Slide-Studio-macOS-arm64.zip` on Apple Silicon. Local builds are ad-hoc signed and are not notarized for public distribution.

## Browser quick start

Requires **Python 3.9 or newer** and a modern desktop browser. No Python packages, Node.js installation, or build step is required to run the editor.

```sh
git clone https://github.com/donaldhxp0127/HTML-Slide-Editor.git
cd HTML-Slide-Editor
python3 slide-editor/server.py
```

Open **http://127.0.0.1:8765/** and keep the terminal running. Press `Ctrl+C` in the terminal to stop the server.

On macOS, you can also double-click `slide-editor/启动编辑器.command`.

### Add your slide decks

Place each deck in its own folder inside the repository, alongside `slide-editor/`. Keep its CSS, JavaScript, and image files together so relative resource paths continue to work.

```text
HTML-Slide-Editor/
├── README.md
├── slide-editor/
│   ├── server.py
│   ├── index.html
│   ├── editor.js
│   ├── i18n.js
│   └── editor.css
└── my-slides/
    ├── index.html
    ├── styles.css
    ├── script.js
    └── assets/
```

Slide pages must use the `.slide` class, for example `<section class="slide">...</section>`. This version uses a **1280 × 720 (16:9)** editing viewport. It is designed for static HTML slide decks; it is not a general-purpose webpage editor.

After adding files, refresh the editor, select a deck from the dropdown, and click **Open**. Personal slide decks are not bundled with this repository. Add your own deck folders to `.gitignore` if you want them to stay local.

## Editing

- **Select:** click text, an image, or a container. On narrow windows, use **Properties** to show the inspector.
- **Edit text:** double-click text and type, including while Drag mode is enabled. Press `Esc` to finish. Edit within existing styled text to retain nested formatting.
- **Resize and align:** drag any of the eight selection handles. Hold `Shift` on a corner to retain the aspect ratio. In Drag mode, elements snap to slide edges, the center, and common content edges; pink guides show alignment. Hold `Alt` to bypass snapping.
- **Adjust styles:** change font size, text/background color, alignment, width, height, or image path in the inspector.
- **Move:** drag an element with **Drag mode** (enabled by default). Use **Select parent** to move a containing group. Movement is saved as standard CSS `translate`.
- **Manage slides:** real slide thumbnails appear in the sidebar. Drag a thumbnail or its grip to a blue insertion line between pages, or use the up/down buttons. Use **＋ New slide** at the end of the sidebar to create a page matching the deck’s normal slide template. Duplicate and delete pages with the toolbar; at least one page is retained. Hardcoded footer numbers must still be updated manually.
- **Work with multiple elements:** Shift/Cmd/Ctrl-click to select multiple elements, then move or style them together. Group elements from the same container using **Group** (`Cmd/Ctrl+G`), and ungroup with `Cmd/Ctrl+Shift+G`. Grouping fixes the affected container’s current geometry to prevent flow-layout siblings from shifting.
- **Manage layers:** select elements from the Layers list, bring them forward/backward, hide/show them, or lock/unlock them. Locked elements cannot be moved, resized, restyled, or deleted through visual controls. Grouping is blocked if the affected container has locked siblings. Lock state is saved in a standard `data-slide-locked` attribute.
- **Add images:** use **＋ Image** or drop an image onto the canvas. Replace a selected image, crop it with the inset slider, or reset cropping. New images are embedded as data URLs (maximum 8 MB per image), so exporting does not require copying new image files. Existing image paths remain intact.
- **Keyboard controls:** Delete/Backspace removes unlocked selected elements; arrow keys move them by 1 px, or 10 px with Shift. Undo and redo include resizing, grouping, image operations, and slide management.
- **Save:** click **Save file** or press `Cmd/Ctrl+S`. A side-by-side line diff shows the original and edited HTML before you confirm saving. Cancel returns to editing. Each confirmed save backs up the previous file under `.slide-editor-backups/`. If another editor or AI has changed the original file, saving is blocked to prevent overwriting those changes.
- **Export:** download the edited HTML. Relative paths are retained, so keep exported HTML with the matching CSS, JavaScript, and assets.
- **Export PDF / PPTX:** export the current page order, including unsaved visual edits, as a 16:9 PDF or PowerPoint `.pptx`. Each page uses a 2560 × 1440 image to preserve its appearance. PDF text is rasterized, and PPTX text is not individually editable; continue editing in HTML. Exports include speaker notes in PPTX when available. Generation runs locally (native WebKit capture on macOS, bundled canvas capture in browsers), has progress/cancellation, and never overwrites your HTML. External images must allow CORS access.
- **Present:** open the saved deck in a new tab. Save edits before presenting.

## Source and visual editing together

Clicking an element automatically opens the source panel, scrolls to its HTML, highlights the corresponding code, and displays its line number. Mapping follows the selected DOM element, so identical text in multiple places is distinguished correctly.

The source panel includes HTML syntax coloring, and its selection highlight stays visible when the canvas has focus. You can edit the full HTML in the source panel and click **Apply source** to update the canvas. If source edits have not been applied, selecting another element preserves that draft. Apply it or click **Revert source** to resume automatic source navigation. Saving and exporting require you to resolve pending source edits first.

## Readable HTML for people and AI

- Existing tags, classes, external stylesheets, and relative asset paths are preserved.
- Element style overrides use regular inline CSS.
- There is no proprietary document format and no screenshot-based representation of slides.
- Source view adds line breaks before common block elements. Applying that source saves the formatted structure.
- Browser HTML serialization can normalize quotes, tag case, and other formatting. Byte-for-byte minimal diffs are not guaranteed.

## Current limitations

- PPTX currently exports high-resolution page images rather than editable PowerPoint objects. PDF text is not selectable. Free-form image crop boxes and arbitrary rotation controls are not available. Image cropping currently applies a symmetric percentage inset.
- Grouping converts the affected container to explicit positions; undo restores its previous layout. Complex transformed/rotated layouts may require source adjustments.
- The editor accepts save requests up to 20 MB. Embedded images increase HTML size. Large documents use a simpler diff, and undo history is capped to limit memory usage.
- Original scripts are disabled in the editing canvas and restored on save/export. Script-generated content, dynamic charts, and custom interactions are not supported in the canvas. Static images and SVG can be displayed.
- External CSS files are loaded but cannot be edited through the inspector; element changes are stored in the HTML.
- Only HTML files under the project folder can be opened through the editor API.

## Local operation

The server binds to `127.0.0.1`; edit and save requests are handled locally. Decks can still load external resources referenced by their own HTML/CSS. Keep the server on your own computer and use trusted decks. This is a local editing tool, not a hosted multi-user service.

## Project files

| File | Purpose |
| --- | --- |
| `slide-editor/server.py` | Local HTTP server, deck discovery, backups, and save conflict detection |
| `slide-editor/index.html` | Editor interface |
| `slide-editor/editor.js` | Visual editing, source mapping, undo/redo, and serialization |
| `slide-editor/enhancements.js` | Resize/snap tools, thumbnails, images, layers, groups, source coloring, and save review |
| `desktop/macos/SlideStudio.swift` | Native Mac window, bundled local service, file picker, downloads, and app lifecycle |
| `slide-editor/exports.js` | Local PDF/PPTX capture and file generation |
| `slide-editor/vendor/` | Pinned export libraries and license notices |
| `slide-editor/desktop.js` | Optional integration with the Mac host |
| `slide-editor/i18n.js` | Chinese, English, and Japanese UI translations |
| `slide-editor/editor.css` | Editor layout and responsive styles |

For JavaScript syntax checks during development:

```sh
node --check slide-editor/editor.js
node --check slide-editor/i18n.js
node --check slide-editor/enhancements.js
node --check slide-editor/exports.js
```
