import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { colouredStops, type CoverReading } from './coverAccent.ts';
import { themeSurroundings } from './registry.ts';
import { readSystemPalette } from './systemPalette.ts';
import { useThemeNeeds } from './index';
import { artworkFor } from '../media/artwork';
import { artworkRevision, subscribeArtwork } from '../media/artworkEvents';
import { useCurrentId } from '../player/current';
import { whenStill } from '../ui/moving.ts';

import JukeboxAudio from '../../../modules/jukebox-audio/index.ts';

/**
 * Keeps the themes told about what is around them: the cover of what is
 * playing, and the phone's palette.
 *
 * Draws nothing. It is a component only because what is playing is known to
 * the player's provider and to nothing outside it, so whatever watches has
 * to be mounted inside; it goes in the root layout, once, under the player.
 * The theme itself stays where it was, read from a store by anything
 * anywhere, the layout above the player included.
 *
 * Nothing about any one theme is here. A theme says what it needs, and this
 * fetches a thing only while the chosen theme has asked for it — reading the
 * colours out of a cover is a picture decoded, and an app set to plain dark
 * should not be decoding one per song for a theme nobody is looking at.
 *
 * What it costs to redraw: this component is redrawn whenever the player's
 * state changes, which is to draw nothing again. The screens are redrawn when
 * the store is written, and that is once a track at most, and not at all
 * when the next track's cover gives the colours the last one did — an album
 * played through changes nothing. Where the player has got to is not in its
 * state, so the ticking of a song never arrives here.
 */
/** How long a new record's colours wait after they are known, for the tap that started it to have become a scroll or not. */
const SKY_WAITS_MS = 600;

export function ThemeSurroundings() {
  const wantsCover = useThemeNeeds().includes('cover');
  const trackId = useCurrentId();
  // A cover replaced from the Tags screen is a new cover for the same track.
  const revision = useSyncExternalStore(subscribeArtwork, artworkRevision);

  useEffect(() => {
    if (!wantsCover) return;
    let alive = true;
    let pause: ReturnType<typeof setTimeout> | undefined;
    let letGo: (() => void) | undefined;
    /*
      The colours in hand are left alone until the new ones arrive. Clearing
      them first would take the app from one record's colour to the default
      and on to the next record's, two changes where one was meant, and the
      one in the middle is a flash.
    */
    const settle = (read: CoverReading | readonly string[] | null | undefined) => {
      if (!alive) return;
      // A grey cover is no cover here: it has no colour to lend.
      const cover = colouredStops(read);
      const held = themeSurroundings.get();
      if ((held.cover?.join() ?? null) === (cover?.join() ?? null)) return;
      /*
        These colours are every row of every screen drawn again, all in one
        go, and a song starts just when somebody is likely to be scrolling:
        a moment after they tapped a row. So not until the moment has passed,
        and no list is moving; a sky a second late is not seen to be, and a
        list that catches under the finger is.
      */
      pause = setTimeout(() => {
        letGo = whenStill(() => {
          const now = themeSurroundings.get();
          themeSurroundings.set({ ...now, cover });
        });
      }, SKY_WAITS_MS);
    };
    const stop = () => {
      alive = false;
      clearTimeout(pause);
      letGo?.();
    };
    if (!trackId) {
      settle(null);
      // Undone like any other: left waiting, it took the colours away from the song put on next, a cover alike or not.
      return stop;
    }
    artworkFor(trackId)
      // The reading that says what the cover's colour really was, where the
      // build has it; the bare stops, as before, where it has not.
      .then<CoverReading | readonly string[] | null | undefined>((path) =>
        !path
          ? null
          : JukeboxAudio.coverReadingAsync
            ? JukeboxAudio.coverReadingAsync(path)
            : JukeboxAudio.coverColoursAsync?.(path)
      )
      .then(settle)
      .catch(() => settle(null));
    return stop;
  }, [wantsCover, trackId, revision]);

  useEffect(() => {
    const watching = AppState.addEventListener('change', (state) => {
      if (state === 'active') readSystemPalette();
    });
    return () => watching.remove();
  }, []);

  return null;
}
