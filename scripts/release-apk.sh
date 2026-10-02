#!/usr/bin/env bash
#
# Sign the built release APK with the release key, for handing to other people.
#
# A build signs itself with the debug keystore, and that is the right key for a
# phone on the desk and the wrong one for a download page: it ships with every
# React Native project, its password is `android`, and anybody can sign an
# "update" with it that Android will install over the real thing. What is
# published is signed with a key that exists in one place and is not in this
# repository.
#
# Signed afterwards rather than by Gradle, because android/ is generated: a
# signing config written there lasts until the next prebuild, and one that
# reads a key from outside the project is one more thing a fresh checkout
# cannot build without. This way the build needs nothing, and only publishing
# needs the key.
#
# Usage:  scripts/release-apk.sh
#
# Needs a built APK (cd android && ./gradlew :app:assembleRelease) and a
# signing.properties with storeFile, keyAlias and storePassword, looked for in
# $JUKEBOX_SIGNING or ~/.jukebox-signing.
set -euo pipefail

cd "$(dirname "$0")/.."

signing="${JUKEBOX_SIGNING:-$HOME/.jukebox-signing}/signing.properties"
if [ ! -f "$signing" ]; then
  echo "No release key: $signing is not there." >&2
  exit 1
fi
prop() { grep "^$1=" "$signing" | cut -d= -f2-; }

built=android/app/build/outputs/apk/release/app-release.apk
if [ ! -f "$built" ]; then
  echo "Nothing to sign. Build first: cd android && ./gradlew :app:assembleRelease" >&2
  exit 1
fi

tools=$(ls -d "${ANDROID_HOME:-$HOME/Android/Sdk}"/build-tools/* | sort -V | tail -1)
version=$(node -p "require('./package.json').version")

# The APK says what it is, and it has to be what is about to be named. A build
# left over from before the version was raised would otherwise go out under the
# new number.
inside=$("$tools/aapt2" dump badging "$built" | sed -n "s/.*versionName='\([^']*\)'.*/\1/p" | head -1)
if [ "$inside" != "$version" ]; then
  echo "The built APK is $inside and package.json says $version. Rebuild first." >&2
  exit 1
fi

mkdir -p dist
out="dist/Jukebox-$version-arm64-v8a.apk"

# The password goes through the environment and not the command line, where
# anything that can list processes could read it.
#
# Only signature scheme 3 comes out, and that is the signer's choice rather
# than an omission: the app does not install below Android 10, every phone that
# can run it verifies scheme 3, and asking for scheme 2 by name changes nothing.
JUKEBOX_KS_PASS=$(prop storePassword) "$tools/apksigner" sign \
  --ks "$(prop storeFile)" \
  --ks-key-alias "$(prop keyAlias)" \
  --ks-pass env:JUKEBOX_KS_PASS \
  --out "$out" \
  "$built"
rm -f "$out.idsig"

"$tools/apksigner" verify "$out"
echo "Signed: $out"
"$tools/apksigner" verify --print-certs "$out" | grep -E "certificate (DN|SHA-256)"
echo "SHA-256 of the file: $(sha256sum "$out" | cut -d' ' -f1)"
