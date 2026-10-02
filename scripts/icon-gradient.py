"""
What the background behind the mark actually is, measured from the drawing.

Answers two colours on one line — the gradient at the middle, where the mark
sits, and the gradient out at the corners — for `icons.sh` to build the
adaptive icon's background from.

    python3 scripts/icon-gradient.py opaque.png transparent.png
    srgb(44,38,63) srgb(74,75,104)

Measured rather than sampled. Reading two corner pixels is right only while the
gradient runs corner to corner, and a drawing whose background is dark behind
the mark and pale at the edges answers with two pale pixels and no gradient at
all. The transparent drawing says which pixels are background; the opaque one
says what colour they are; everything else is an average.
"""

import math
import sys

from PIL import Image

# Enough to average over, small enough to be instant. The gradient is smooth by
# construction, so nothing is lost by not reading all nine million pixels.
SIZE = 300

# Below this a pixel counts as background rather than as the mark's edge.
# Anti-aliasing puts a rim of part-transparent pixels around every stroke, and
# those carry the mark's colour, not the background's.
CLEAR = 8

# A band is a tenth of the half-width. The corner of a square is further from
# the centre than its edge, which is why there are eleven of them.
BANDS = 11

# Too few pixels to trust an average from.
ENOUGH = 30


def bands_of(opaque: Image.Image, transparent: Image.Image) -> dict[int, list[int]]:
    """Running totals of the background's colour, by distance from the centre."""
    pixels = opaque.load()
    alpha = transparent.split()[3].load()
    middle = (SIZE - 1) / 2

    totals: dict[int, list[int]] = {}
    for y in range(SIZE):
        for x in range(SIZE):
            if alpha[x, y] > CLEAR:
                continue
            away = math.hypot(x - middle, y - middle) / (SIZE / 2)
            band = min(int(away * 10), BANDS - 1)
            running = totals.setdefault(band, [0, 0, 0, 0])
            red, green, blue = pixels[x, y]
            running[0] += red
            running[1] += green
            running[2] += blue
            running[3] += 1
    return totals


def mean(totals: dict[int, list[int]], wanted: range) -> str:
    kept = [totals[band] for band in wanted if totals.get(band, [0, 0, 0, 0])[3] >= ENOUGH]
    if not kept:
        raise SystemExit('the drawing shows too little background to measure')
    count = sum(band[3] for band in kept)
    return 'srgb(%d,%d,%d)' % tuple(sum(band[i] for band in kept) // count for i in range(3))


def main() -> None:
    opaque = Image.open(sys.argv[1]).convert('RGB').resize((SIZE, SIZE), Image.LANCZOS)
    transparent = Image.open(sys.argv[2]).convert('RGBA').resize((SIZE, SIZE), Image.LANCZOS)
    totals = bands_of(opaque, transparent)
    # The inner half is what the mark is read against; the outer three bands are
    # the corners, which is all a launcher's mask leaves of the edge.
    print(mean(totals, range(0, 5)), mean(totals, range(8, BANDS)))


if __name__ == '__main__':
    main()
