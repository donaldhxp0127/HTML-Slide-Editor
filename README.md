# Slide Studio — HTML Slide Editor

[English](README.md) · [简体中文](README.zh-CN.md)

A local visual editor for HTML slide decks. Edit text directly on a slide, move elements, adjust styles, and jump to the corresponding HTML source. Saved files remain ordinary HTML that you or an AI coding assistant can continue editing.

The editor UI supports **English, 日本語, and 中文**, with your language preference remembered in the browser. Slide content is not translated.

## Quick start

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
- **Edit text:** double-click text and type. Press `Esc` to finish. Edit within existing styled text to retain nested formatting.
- **Adjust styles:** change font size, text/background color, alignment, width, height, or image path in the inspector.
- **Move:** enable **Drag mode**, then drag an element. Use **Select parent** to move a containing group. Movement is saved as standard CSS `translate`.
- **Manage content:** add text boxes, duplicate slides, delete elements, undo, and redo. Hardcoded footer page numbers must be updated manually after duplication.
- **Save:** click **Save file** or press `Cmd/Ctrl+S`. Each save backs up the previous file under `.slide-editor-backups/`. If another editor or AI has changed the original file, saving is blocked to prevent overwriting those changes.
- **Export:** download the edited HTML. Relative paths are retained, so keep exported HTML with the matching CSS, JavaScript, and assets.
- **Present:** open the saved deck in a new tab. Save edits before presenting.

## Source and visual editing together

Clicking an element automatically opens the source panel, scrolls to its HTML, highlights the corresponding code, and displays its line number. Mapping follows the selected DOM element, so identical text in multiple places is distinguished correctly.

You can edit the full HTML in the source panel and click **Apply source** to update the canvas. If source edits have not been applied, selecting another element preserves that draft. Apply it or click **Revert source** to resume automatic source navigation. Saving and exporting require you to resolve pending source edits first.

## Readable HTML for people and AI

- Existing tags, classes, external stylesheets, and relative asset paths are preserved.
- Element style overrides use regular inline CSS.
- There is no proprietary document format and no screenshot-based representation of slides.
- Source view adds line breaks before common block elements. Applying that source saves the formatted structure.
- Browser HTML serialization can normalize quotes, tag case, and other formatting. Byte-for-byte minimal diffs are not guaranteed.

## Current limitations

- No multiple selection, snapping, resize handles, image upload, or PPTX export.
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
| `slide-editor/i18n.js` | Chinese, English, and Japanese UI translations |
| `slide-editor/editor.css` | Editor layout and responsive styles |

For JavaScript syntax checks during development:

```sh
node --check slide-editor/editor.js
node --check slide-editor/i18n.js
```
