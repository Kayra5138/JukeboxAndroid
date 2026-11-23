import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { processColor, StyleSheet, View } from 'react-native';
import { requireNativeViewManager } from 'expo-modules-core';

import JukeboxAudio from '../../modules/jukebox-audio';
import { artworkFor } from '../lib/media/artwork';
import { fromLch, toLch } from '../lib/theme/colour';
import { useColours } from '../lib/theme/index';
import { underGlass } from '../lib/theme/Veil';
import type { CoverMotion } from '../lib/ui/coverFace';

/**
 * What moves with the music round or over what stands where the cover is in
 * the player, [children]; drawn by the native side (`spectrum/SpectrumView.kt`),
 * and nothing of the music comes through here.
 *
 * Beside what stands there, behind it or over it, in a view of the two: not
 * round it, as a view drawn at every frame has what it holds drawn again with
 * it, and a cover's picture was sent to the screen again each time. The view
 * of the two is what grows when it breathes or jumps on a beat, and is kept a
 * view of its own for that rather than folded away.
 *
 * Laid out for each of the three things it can hold: the cover, square with
 * rounded corners; a record, round, with its label in the middle; a cassette,
 * narrower than the square it is in. It draws only while [active], and when it
 * is not the samples are not even looked at; put in only where a motion is
 * wanted, it costs nothing otherwise.
 *
 * The sparks, the clouds and a breath's glow are drawn the size of the
 * player, by {@link SpectrumStage}; here they only say where what stands
 * there is, by [onPlace]. A breath swells what stands there here as well.
 */
export function Spectrum({
  motion,
  face,
  size,
  active,
  accent,
  onPlace,
  placeIn,
  trackId,
  children,
}: {
  motion: Exclude<CoverMotion, 'none'>;
  face: 'cover' | 'record' | 'cassette';
  /** The side of the square it holds. */
  size: number;
  active: boolean;
  /** The theme's colour, for what is drawn off the cover. */
  accent: string;
  /** Where what stands there is within [placeIn], for the sparks and the clouds laid over that. */
  onPlace?: (place: Place) => void;
  placeIn?: RefObject<View | null>;
  /** The song playing, for the colour of its cover. */
  trackId?: string | null;
  children: ReactNode;
}) {
  const c = useColours();
  const held = useRef<View>(null);
  if (motion === 'sparks' || motion === 'aurora' || motion === 'breathe') {
    /*
      Measured within the player's screen, which the sparks and the clouds are
      laid over, by where it is laid out there: not in the window, where the
      player is somewhere else at each step of rising or being slid away, and
      a place found at one step and used at another put the sparks off the top.
    */
    const measure = () => {
      const within = placeIn?.current;
      if (!within) return;
      held.current?.measureLayout(within, (x, y, width, height) => {
        // A cassette is narrower than its square: where the cassette itself is.
        const inset = face === 'cassette' ? height * CASSETTE_INSET : 0;
        onPlace?.({ x, y: y + inset, width, height: height - inset * 2, round: face === 'record' });
      });
    };
    return (
      <View
        ref={held}
        collapsable={false}
        // A breath swells it, and is given the room for that, though not for the glow.
        style={roomOf(motion)}
        onLayout={measure}>
        {motion === 'breathe' ? (
          <NativeSpectrum
            pointerEvents="none"
            mode="swell"
            active={active}
            colour="#ffffffff"
            room={[0, 1]}
            ring={[0, 1]}
            inset={[0, 0]}
            shade={false}
            strength={1}
            round={false}
            corner={0}
            style={styles.none}
          />
        ) : null}
        {children}
      </View>
    );
  }
  const shape = shapeOf(motion, face, size);
  // Over a cover whatever it shows, in white; off it, in the theme's colour.
  const over = face === 'cover' && (motion === 'spectrum' || motion === 'scope' || motion === 'spectrogram');
  const drawn = (
    <NativeSpectrum
      pointerEvents="none"
      mode={shape.mode}
      active={active}
      colour={hexOf(over ? '#ffffff' : accent)}
      room={shape.room ?? [0.6, 1]}
      ring={shape.ring ?? [0.46, 0.98]}
      inset={shape.inset ?? [0, 0]}
      shade={shape.shade ?? false}
      // Half seen through over a theme of glass, as everything over it is.
      strength={(motion === 'spectrum' || motion === 'spectrogram') && underGlass(c) > 0 ? GLASS_STRENGTH : 1}
      round={face === 'record'}
      corner={shape.corner ?? 0}
      style={StyleSheet.absoluteFill}
    />
  );
  // Rings behind it, the rest over it.
  const behind = shape.mode === 'ripple' || shape.mode === 'punch';
  return (
    <View collapsable={false} style={roomOf(motion)}>
      {behind ? drawn : null}
      {children}
      {behind ? null : drawn}
    </View>
  );
}

/** Where what stands where the cover is is, within the player's screen, in points. */
export type Place = { x: number; y: number; width: number; height: number; round: boolean };

/**
 * The sparks over the whole player, or the clouds or a breath's glow behind
 * all of it, about the cover at [place]. Laid over the player's whole screen,
 * and touched through.
 */
export function SpectrumStage({
  motion,
  place,
  active,
  accent,
  trackId,
}: {
  motion: 'sparks' | 'aurora' | 'breathe';
  place: Place | null;
  active: boolean;
  accent: string;
  trackId: string | null;
}) {
  // The clouds in the cover's colours, and a breath glowing in a bright one of them.
  const colours = useCoverStops(motion === 'sparks' ? null : trackId);
  return (
    <NativeSpectrum
      pointerEvents="none"
      mode={motion}
      active={active && place != null}
      colour={hexOf(motion === 'breathe' ? glowOf(colours, accent) : accent)}
      room={[0.6, 1]}
      ring={[0.46, 0.98]}
      inset={[0, 0]}
      shade={false}
      strength={1}
      round={place?.round ?? false}
      corner={COVER_CORNER}
      target={place ? [place.x, place.y, place.width, place.height] : [0, 0, 0, 0]}
      colours={(colours ?? [accent]).map(hexOf)}
      style={StyleSheet.absoluteFill}
    />
  );
}

/** The colours of the cover of [trackId], as the cover is read for them: null until they are read, or for none. */
function useCoverStops(trackId: string | null): readonly string[] | null {
  const [stops, setStops] = useState<{ of: string; stops: readonly string[] } | null>(null);
  useEffect(() => {
    if (!trackId) return;
    let alive = true;
    artworkFor(trackId)
      .then((path) => (path ? JukeboxAudio.coverColoursAsync?.(path) : null))
      .then((found) => {
        if (alive && found && found.length > 0) setStops({ of: trackId, stops: found });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [trackId]);
  return stops && stops.of === trackId ? stops.stops : null;
}

/**
 * How far past its edge the rings and the glow go, in points: the room the
 * player leaves round what stands where the cover is for them, as the box it is
 * in cuts off anything past it. As far as `RING_REACH_DP` in `SpectrumView.kt`.
 */
export const EDGE_ROOM = 22;

/** The room a breath needs: the cover grown a twentieth. Its glow is drawn behind the whole player, past the box it is in. */
const BREATH_ROOM = 10;

/** The room a jump on the beat needs: six hundredths of the cover either way. */
const PUNCH_ROOM = 10;

/** How much of the spectrum is drawn over a theme of glass. */
const GLASS_STRENGTH = 0.55;

/**
 * How much smaller than its box what stands there is drawn for [motion], so
 * that what goes round it has room inside the box, which cuts off whatever
 * reaches past it.
 */
export function roomTaken(motion: CoverMotion): number {
  if (motion === 'ripple') return EDGE_ROOM * 2;
  if (motion === 'breathe') return BREATH_ROOM * 2;
  return motion === 'punch' ? PUNCH_ROOM * 2 : 0;
}

/** That room, round it, so that the two together fill the box again. */
function roomOf(motion: CoverMotion) {
  const room = roomTaken(motion) / 2;
  return room > 0 ? { margin: room } : undefined;
}

type Shape = {
  mode: 'bars' | 'ring' | 'ripple' | 'punch' | 'scope' | 'spectrogram';
  room?: [number, number];
  ring?: [number, number];
  inset?: [number, number];
  shade?: boolean;
  corner?: number;
};

/** The cover's rounded corners (`art` in `PlayerSheet`), and a cassette's, which are a share of how tall it is. */
const COVER_CORNER = 12;
const CASSETTE_INSET = 0.18;
const cassetteCorner = (size: number) => size * 0.64 * 0.08;

/** Under a cassette, in the room its square leaves. */
const UNDER_CASSETTE: [number, number] = [0.84, 0.99];

function shapeOf(motion: Exclude<CoverMotion, 'none' | 'sparks' | 'aurora' | 'breathe'>, face: 'cover' | 'record' | 'cassette', size: number): Shape {
  const edge: Shape =
    face === 'record'
      ? { mode: 'ripple' }
      : face === 'cassette'
        ? { mode: 'ripple', inset: [0, CASSETTE_INSET], corner: cassetteCorner(size) }
        : { mode: 'ripple', corner: COVER_CORNER };
  switch (motion) {
    case 'spectrum':
      if (face === 'record') return { mode: 'ring', ring: [0.47, 0.98] };
      // Up the foot of a cover.
      if (face === 'cassette') return { mode: 'bars', room: UNDER_CASSETTE };
      return { mode: 'bars', room: [0.6, 1], shade: true, corner: COVER_CORNER };
    case 'scope':
      if (face === 'record') return { mode: 'scope', ring: [0.5, 0.96] };
      if (face === 'cassette') return { mode: 'scope', room: UNDER_CASSETTE };
      // Across the middle of a cover, as loud as it gets coming toward three tenths from its top and its foot.
      return { mode: 'scope', room: [0.3, 0.7] };
    case 'spectrogram':
      // Round a record's label, time going round it; along the foot of a cover, inside its corners.
      if (face === 'record') return { mode: 'spectrogram', ring: [0.46, 0.97] };
      if (face === 'cassette') return { mode: 'spectrogram', room: UNDER_CASSETTE };
      return { mode: 'spectrogram', room: [0.68, 1], corner: COVER_CORNER };
    case 'ripple':
      return edge;
    case 'punch':
      return { mode: 'punch' };
  }
}

/**
 * The colour a breath glows in: the most colourful of the cover's own, made
 * bright, light and full, to be seen glowing over a dark player, as the cover's first was
 * often a dark one and its glow was not seen at all. The theme's colour where
 * the cover has none to give, or is grey.
 */
function glowOf(stops: readonly string[] | null, accent: string): string {
  if (!stops || stops.length === 0) return accent;
  const vivid = stops.map(toLch).reduce((best, each) => (each.c > best.c ? each : best));
  // A grey cover has no colour of its own to glow in, only a hue made up.
  if (vivid.c < GREY) return accent;
  return fromLch({ l: Math.max(vivid.l, GLOW_LIGHT), c: Math.max(vivid.c, GLOW_CHROMA), h: vivid.h });
}

/** How light a breath's glow is at the least, and how colourful. */
const GLOW_LIGHT = 82;
const GLOW_CHROMA = 50;
/** Less colourful than this, a cover is grey. */
const GREY = 8;

/** Any colour React Native reads, as the `#aarrggbb` Android reads: a theme's may be a name or a function of its own. */
function hexOf(colour: string): string {
  const packed = processColor(colour);
  return typeof packed === 'number' ? `#${(packed >>> 0).toString(16).padStart(8, '0')}` : '#ffffffff';
}

const styles = StyleSheet.create({
  none: { position: 'absolute', width: 0, height: 0 },
});

const NativeSpectrum = requireNativeViewManager<{
  pointerEvents?: 'none';
  style?: object;
  mode: string;
  active: boolean;
  colour: string;
  room: number[];
  ring: number[];
  inset: number[];
  shade: boolean;
  strength: number;
  round: boolean;
  corner: number;
  target?: number[];
  colours?: string[];
}>('JukeboxAudio', 'SpectrumView');
