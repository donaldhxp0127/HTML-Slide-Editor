# Slide Studio for macOS

A native AppKit/WebKit desktop app that bundles the HTML editor and its local file service. The packaged app requires no Python, Node.js, terminal, or network connection to run. Decks may still reference online fonts or other external assets.

## Use

1. Unzip `Slide-Studio-macOS-arm64.zip`.
2. Move `Slide Studio.app` to Applications, or run it directly.
3. First launch opens the bundled five-slide Landing Page tutorial. Use **Open file / folder** or `Cmd+O` to choose your own HTML deck or its containing folder.
4. Edit and save as usual. Save review, backups, and external-change checks are retained.

PDF and PPTX export are available from the header. PPTX exports native editable text, independent pictures and basic shapes. Wrapped text is split into line boxes to preserve browser layout; complex effects (including SVG and transformed groups) remain images, and fonts may vary between machines. PDF uses high-resolution page images and WebKit’s native PDF renderer for reliable page capture. The sidebar supports drop-between-page reordering and a bottom **＋ New slide** button.

The last selected folder is remembered. Backups stay in that folder under `.slide-editor-backups`. The app listens only on loopback and chooses a free port. Quitting the app stops its service. Unsaved changes are checked when closing, quitting, reloading, or switching folders.

The web editor UI supports English, Japanese, and Chinese. Native macOS menus and host dialogs currently use English.

## Build

On macOS with Xcode Command Line Tools:

```sh
./desktop/macos/build.sh
```

Outputs are in `dist/`. The build targets the host architecture (Apple Silicon or Intel) and macOS 12+. The Apple Silicon build has been tested on this machine; Intel builds and older macOS versions have not been tested.

This build uses an ad-hoc code signature for local use. It is not signed with an Apple Developer ID or notarized for public distribution. For a public download, rebuild/sign/notarize using the maintainer's Apple Developer account.

No personal slide decks are included in the app bundle or archive.
