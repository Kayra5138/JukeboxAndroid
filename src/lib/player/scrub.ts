import { createStore } from '../ui/store';

/**
 * Where a finger on the player's bar has the song, in seconds, while it is
 * held there; null when nobody is scrubbing. The song is moved only when the
 * finger lets go, and until then this is the only place the time under it is
 * told: a record follows it as it is dragged, back and on, and is there when
 * the song gets there (`components/CoverFace.tsx`).
 *
 * Watched outside React, so that what follows it is moved sixty times a second
 * without anything being drawn again.
 */
export const scrubbing = createStore<number | null>(null);
