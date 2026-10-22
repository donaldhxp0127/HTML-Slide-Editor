#!/bin/zsh
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUTPUT="${SLIDE_STUDIO_OUTPUT_DIR:-$PROJECT_ROOT/dist}"
APP="$OUTPUT/Slide Studio.app"
CACHE="${TMPDIR:-/tmp}/slide-studio-swift-cache"
mkdir -p "$OUTPUT" "$CACHE" "$APP/Contents/MacOS" "$APP/Contents/Resources/editor"
TARGET_ARCH="$(uname -m)"
xcrun swiftc -O -target "$TARGET_ARCH-apple-macos12.0" -module-cache-path "$CACHE" "$PROJECT_ROOT/desktop/macos/SlideStudio.swift" -o "$APP/Contents/MacOS/SlideStudio"
cp "$PROJECT_ROOT/desktop/macos/Info.plist" "$APP/Contents/Info.plist"
for file in index.html editor.css editor.js i18n.js enhancements.js desktop.js exports.js; do
  cp "$PROJECT_ROOT/slide-editor/$file" "$APP/Contents/Resources/editor/$file"
done
mkdir -p "$APP/Contents/Resources/editor/vendor"
cp "$PROJECT_ROOT/slide-editor/vendor/"* "$APP/Contents/Resources/editor/vendor/"
xcrun swiftc -O -module-cache-path "$CACHE" "$PROJECT_ROOT/desktop/macos/Icon.swift" -o "$OUTPUT/make-icon"
"$OUTPUT/make-icon" "$OUTPUT/AppIcon.iconset" "$APP/Contents/Resources/AppIcon.icns"
codesign --force --sign - "$APP"
ditto -c -k --sequesterRsrc --keepParent "$APP" "$OUTPUT/Slide-Studio-macOS-$TARGET_ARCH.zip"
printf 'Built: %s\nArchive: %s\n' "$APP" "$OUTPUT/Slide-Studio-macOS-$TARGET_ARCH.zip"
