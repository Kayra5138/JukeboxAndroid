import type { Track } from '../types.ts';

/** A library track with only the fields a test cares about filled in. */
export function track(fields: Partial<Track> & { id: string }): Track {
  return {
    uri: `content://media/external/audio/media/${fields.id}`,
    title: 'Untitled',
    artist: null,
    album: null,
    artworkUri: null,
    durationSec: 240,
    trackNumber: null,
    filename: null,
    folder: null,
    addedAt: null,
    ...fields,
  };
}
