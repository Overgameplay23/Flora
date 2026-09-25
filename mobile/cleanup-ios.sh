#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IOS_DIR="$ROOT_DIR/ios"

# Remove iOS build artifacts and pods to ensure a clean native rebuild.
if [ ! -d "$IOS_DIR" ]; then
  echo "iOS directory not found at: $IOS_DIR"
  exit 1
fi

echo "Cleaning iOS artifacts..."
cd "$IOS_DIR"
rm -rf Pods build Podfile.lock

# Clear Xcode DerivedData to remove cached build products.
DERIVED_DATA="$HOME/Library/Developer/Xcode/DerivedData"
if [ -d "$DERIVED_DATA" ]; then
  rm -rf "$DERIVED_DATA"
fi

# Reinstall pods with updated specs.
pod install --repo-update

# Return to the project root.
cd "$ROOT_DIR"

# Reset Metro cache to avoid stale bundles.
TMPDIR_PATH="${TMPDIR:-/tmp}"
rm -rf "$TMPDIR_PATH/metro-cache" "$TMPDIR_PATH/haste-map-*" "$TMPDIR_PATH/react-*"

echo "Done. Next run: npx react-native run-ios"
