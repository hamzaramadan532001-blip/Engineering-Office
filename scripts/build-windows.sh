#!/usr/bin/env bash
# One command -> a Windows-deployable zip.
#   pnpm build:windows
#
# Lands in ./build/ (gitignored):
#   - makkah-gis-winbuild.zip
#   - unzipped deployable copy
#   - build/.src/ (temporary build tree)
#
# Self-contained Next.js standalone bundle; runs on Windows with only Node.js 22
# installed (no pnpm/npm on the host).
#
# Why this isn't just `next build`:
#  - pnpm's node_modules is a web of symlinks that break once unpacked on Windows,
#    so we build in a throwaway copy with a flat (hoisted), symlink-free node_modules.
#  - WINDOWS_BUILD=1 makes next.config.ts emit `output: standalone` and disable
#    the sharp image optimizer, so the artifact is OS-agnostic.
#
# Runs on macOS/Linux/Git Bash.
# Needs: tar, zip, pnpm, node.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$ROOT/build"
BLD="$BUILD_DIR/.src"
OUT="$BUILD_DIR/makkah-gis-winbuild"
ZIP="$BUILD_DIR/makkah-gis-winbuild.zip"

mkdir -p "$BUILD_DIR"

echo "==> [1/4] Syncing source into isolated build tree"

rm -rf "$BLD"
mkdir -p "$BLD"

tar \
  --exclude='./node_modules' \
  --exclude='./.next' \
  --exclude='./.git' \
  --exclude='./.turbo' \
  --exclude='./dist' \
  --exclude='./build' \
  --exclude='*.zip' \
  --exclude='.env*.local' \
  -cf - \
  -C "$ROOT" . | tar -xf - -C "$BLD"

rm -f "$BLD"/apps/gis-viewer/.env*.local

echo "==> Source sync complete"

# Force a flat node_modules for this build only.
printf 'node-linker=hoisted\n' > "$BLD/.npmrc"

echo "==> [2/4] Installing dependencies (hoisted, flat node_modules)"

(
  cd "$BLD"
  HUSKY=0 pnpm install --node-linker=hoisted
)

echo "==> [3/4] Building standalone (WINDOWS_BUILD=1)"

(
  cd "$BLD"
  WINDOWS_BUILD=1 pnpm --filter gis-viewer build
)

echo "==> [4/4] Packaging Windows-portable zip"

(
  cd "$BLD"
  STRIP_SHARP=1 OUT_DIR="$OUT" ZIP_PATH="$ZIP" bash scripts/package-windows.sh
)

echo
echo "================================================================"
echo " Build complete. Send this file to the Windows server:"
echo "   $ZIP  ($(du -h "$ZIP" | cut -f1))"
echo " Unzipped copy:  $OUT"
echo " Run instructions: RUN-ON-WINDOWS.md (inside the zip). Needs Node.js 22."
echo "================================================================"