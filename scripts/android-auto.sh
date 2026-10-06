#!/usr/bin/env bash
# Open the Desktop Head Unit against the phone, so Android Auto can be driven
# from this machine instead of from a car.
#
# The phone has to be prepared once, by hand, before this will show anything:
#   Android Auto settings -> tap the version ten times -> Developer settings
#   -> turn on "Unknown sources" (without it a sideloaded app is never offered)
#   and tap "Start head unit server".
#
# Usage: [AUTO_SCREEN=small|720p|1080p|wide] scripts/android-auto.sh [adb-serial]

set -euo pipefail

SDK="${ANDROID_HOME:-$HOME/Android/Sdk}"
DHU="$SDK/extras/google/auto"

if [ ! -x "$DHU/desktop-head-unit" ]; then
  echo "The head unit is not installed. Fetch it with:" >&2
  echo "  \"$SDK/cmdline-tools/latest/bin/sdkmanager\" --install \"extras;google;auto\"" >&2
  exit 1
fi

DEVICE="${1:-$(adb devices | awk 'NR>1 && $2=="device" {print $1; exit}')}"
if [ -z "$DEVICE" ]; then
  echo "No device. Plug the phone in, or 'adb connect <host>:<port>' for a wireless one." >&2
  exit 1
fi
echo "Using $DEVICE"

# The shipped binary links against a libc++ this distribution does not carry,
# but the NDK inside the SDK does — which is why this needs neither root nor a
# system package. Pick whichever NDK is installed rather than pinning one.
NDKLIB=$(ls -d "$SDK"/ndk/*/toolchains/llvm/prebuilt/linux-x86_64/lib/x86_64-unknown-linux-gnu 2>/dev/null | tail -1 || true)
BUILDLIB=$(ls -d "$SDK"/build-tools/*/lib64 2>/dev/null | tail -1 || true)
export LD_LIBRARY_PATH="${NDKLIB:-}:${BUILDLIB:-}:${LD_LIBRARY_PATH:-}"

# 5277 is the port Android Auto's head unit server listens on.
adb -s "$DEVICE" forward tcp:5277 tcp:5277 >/dev/null
trap 'adb -s "$DEVICE" forward --remove tcp:5277 >/dev/null 2>&1 || true' EXIT

# Which car to pretend to be. Left to itself the head unit is 800x480, a
# screen few cars have had for years, and everything on it looks enormous:
# a tile is the same size on every screen, so a small one holds two rows where
# a real dashboard holds four. 720p is the usual dashboard and the default
# here. AUTO_SCREEN=small is the old one, for seeing the worst case.
case "${AUTO_SCREEN:-720p}" in
  small) CONFIG=config/default.ini ;;
  1080p) CONFIG=config/default_1080p.ini ;;
  wide)  CONFIG=config/default_wide.ini ;;
  *)     CONFIG=config/default_720p.ini ;;
esac

cd "$DHU"
exec ./desktop-head-unit -c "$CONFIG"
