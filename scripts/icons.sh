#!/usr/bin/env bash
#
# Rebuilds every app icon from the drawings in assets/source.
#
#   scripts/icons.sh
#
# Put the new artwork in place first — either by overwriting the files, or by
# dropping them in the project root, which this picks up and files away:
#
#   jukebox background.png     the background, edge to edge, no mark on it
#   Jukebox Transparent.png    the mark alone, with the margin you want round it
#   Jukebox.png                the two flattened together — only needed if you
#                              have no separate background to give
#
# Two layers are much the better way round. An adaptive icon *is* two layers,
# and given one flat picture this has to invent the split: it can recover the
# mark, but the background behind it can only be guessed at from the pixels the
# mark leaves showing, which turns a designed backdrop into two colours and a
# sweep.
#
# Needs ImageMagick 7 (`magick`).
#
# Two more things are not obvious, and both were learned the hard way.
#
# The adaptive icon is drawn on a 108dp canvas of which a launcher only ever
# shows the middle 72dp; the rest is cut away by whatever mask the launcher
# uses. So the *artwork's own canvas* is mapped onto that 72dp, not onto the
# whole 108dp. Scaling the visible mark to a share of the canvas instead throws
# away the margin the artwork was drawn with and pushes it out to the edge of
# the mask.
#
# Where a background has to be guessed at, it is measured rather than read off
# two pixels. That fallback used to sample the top-left and bottom-left corners
# and run a line between them, which held only while the gradient was vertical
# and those corners sat on its ends; a background dark in the middle and pale
# at the edges came back as a flat wash with the mark floating on it.
#
# A guessed background is never rotated. Rotating a square leaves the corners empty, and cropping
# back to size keeps some of that emptiness — which shows as white corners on
# any launcher whose mask is not a circle.
set -euo pipefail

cd "$(dirname "$0")/.."

SOURCE_DIR=assets/source
OPAQUE="$SOURCE_DIR/jukebox-icon.png"
TRANSPARENT="$SOURCE_DIR/jukebox-icon-transparent.png"
# Optional, and much the best way to supply a background: drawn as its own
# layer, it is used as drawn rather than guessed at from a flattened picture.
BACKGROUND="$SOURCE_DIR/jukebox-background.png"
RES=android/app/src/main/res
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

# Fresh drawings left in the project root are adopted, so the usual way to
# update an icon is to drop the two files in and run this.
[ -f "Jukebox.png" ] && mv "Jukebox.png" "$OPAQUE"
[ -f "Jukebox Transparent.png" ] && mv "Jukebox Transparent.png" "$TRANSPARENT"
[ -f "jukebox background.png" ] && mv "jukebox background.png" "$BACKGROUND"

[ -f "$TRANSPARENT" ] || { echo "missing: $TRANSPARENT" >&2; exit 1; }

# A background drawn as its own layer is used as it is, which is the whole
# point of drawing one. Measuring is the fallback for a single flat drawing and
# nothing better: it flattens whatever it is given into two colours and a
# radial sweep, losing any glow, texture or asymmetry the background had.
if [ -f "$BACKGROUND" ]; then
  echo "background: $BACKGROUND, used as drawn"
  magick "$BACKGROUND" -resize '512x512!' "$WORK/bg.png"
else
  read -r inner outer < <(python3 "$(dirname "$0")/icon-gradient.py" "$OPAQUE" "$TRANSPARENT")
  echo "background: measured from the drawing, $inner -> $outer"
  magick -size 512x512 "radial-gradient:$inner-$outer" "$WORK/bg.png"
fi

# The square icon, for launchers too old to mask anything. Composed from the
# two layers where they exist, so it cannot drift from the adaptive one.
if [ -f "$BACKGROUND" ]; then
  magick "$WORK/bg.png" \( "$TRANSPARENT" -resize '512x512!' \) -composite "$WORK/full.png"
elif [ -f "$OPAQUE" ]; then
  magick "$OPAQUE" "$WORK/full.png"
else
  echo "missing: $BACKGROUND (or $OPAQUE)" >&2
  exit 1
fi

magick "$TRANSPARENT" "$WORK/canvas.png"
magick "$WORK/canvas.png" -fill white -colorize 100 "$WORK/canvas-mono.png"
# The splash screen is not masked, so there the mark is sized rather than the
# canvas it sits on, and the drawn margin would only be wasted space.
magick "$TRANSPARENT" -trim +repage -background none -gravity center \
  -extent '%[fx:max(w,h)]x%[fx:max(w,h)]' "$WORK/mark.png"
at() { python3 -c "print(int($1*$2))"; }

fg()     { magick "$WORK/canvas.png"      -resize "$(at "$1" 0.667)x" -background none -gravity center -extent "${1}x${1}" "$2"; }
mono()   { magick "$WORK/canvas-mono.png" -resize "$(at "$1" 0.667)x" -background none -gravity center -extent "${1}x${1}" "$2"; }
bg()     { magick "$WORK/bg.png"   -resize "${1}x${1}!" "$2"; }
legacy() { magick "$WORK/full.png" -resize "${1}x${1}!" "$2"; }
round()  { magick "$WORK/full.png" -resize "${1}x${1}!" \
             \( -size "${1}x${1}" xc:none -fill white \
                -draw "circle $(python3 -c "h=$1/2.0;print(f'{h},{h} {h},0')")" \) \
             -alpha set -compose DstIn -composite "$2"; }
splash() { magick "$WORK/mark.png" -resize "$(at "$1" 0.26)x" -background none -gravity center -extent "${1}x${1}" "$2"; }

# What app.json points at, and what a later `expo prebuild` would regenerate
# the native icons from.
fg 512 assets/images/android-icon-foreground.png
bg 512 assets/images/android-icon-background.png
mono 432 assets/images/android-icon-monochrome.png
legacy 1024 assets/images/icon.png
legacy 48 assets/images/favicon.png
# The splash image is the mark filling its canvas, with no margin of its own.
# How big it is drawn is `imageWidth` in app.json and nothing else: prebuild
# puts this picture on Android's splash canvas at that width. It used to be
# written here already shrunk to a quarter of its canvas, which was right for
# the files written straight into android/ below and wrong for this one --
# prebuild then shrank the shrunken picture, and the mark on the launch screen
# came out a quarter of the size it was drawn to be.
magick "$WORK/mark.png" -resize 512x512 assets/images/splash-icon.png

# android/ is prebuild output and not in git, so it is written directly as well
# — otherwise the icons would not change until someone ran prebuild.
#          density : launcher : adaptive : splash
for entry in mdpi:48:108:288 hdpi:72:162:432 xhdpi:96:216:576 xxhdpi:144:324:864 xxxhdpi:192:432:1152; do
  IFS=: read -r density launcher adaptive splash_px <<<"$entry"
  legacy "$launcher" "$RES/mipmap-$density/ic_launcher.webp"
  round  "$launcher" "$RES/mipmap-$density/ic_launcher_round.webp"
  fg     "$adaptive" "$RES/mipmap-$density/ic_launcher_foreground.webp"
  bg     "$adaptive" "$RES/mipmap-$density/ic_launcher_background.webp"
  mono   "$adaptive" "$RES/mipmap-$density/ic_launcher_monochrome.webp"
  splash "$splash_px" "$RES/drawable-$density/splashscreen_logo.png"
done

# The colour behind the background image, for the rare launcher that asks for
# one. Averaged from the background actually used, whether that was drawn or
# guessed at, since a launcher using this draws the mark straight onto it and
# the mark was drawn to sit on the whole background rather than a corner of it.
#
# Read as hex rather than as a colour string: ImageMagick answers `%[pixel:]`
# in whatever units it thinks best, and it chose percentages — which a reader
# expecting 0-255 turns into nonsense without failing.
python3 - "$(magick "$WORK/bg.png" -resize '1x1!' -format '%[hex:p{0,0}]' info:)" <<'PY'
import json, pathlib, sys
colour = '#' + sys.argv[1][:6].upper()
path = pathlib.Path('app.json')
config = json.loads(path.read_text())
config['expo']['android']['adaptiveIcon']['backgroundColor'] = colour
path.write_text(json.dumps(config, indent=2) + '\n')
print('adaptiveIcon.backgroundColor:', colour)
PY

echo "icons rebuilt. Now: cd android && ./gradlew :app:assembleRelease"
