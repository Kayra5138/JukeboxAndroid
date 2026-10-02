import type { LibraryTrack } from '../../modules/jukebox-audio/index.ts';

/**
 * The media store is the single source of truth for the library, so the app
 * track type is exactly what the native module returns.
 */
export type Track = LibraryTrack;
