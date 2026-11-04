import { useEffect } from 'react';

import JukeboxAudio from '../../../modules/jukebox-audio/index.ts';
import { libraryState, refreshLibrary } from '../library/index.ts';
import type { Track } from '../types.ts';
import { useOpenPlayer } from './NowPlayingSheet';
import { usePlayerActions } from './PlayerProvider';

type Opened = NonNullable<Awaited<ReturnType<NonNullable<typeof JukeboxAudio.readOpenedAudioAsync>>>>;

/**
 * Sound files opened with Jukebox from another app, or shared to it — an MP3
 * sent on WhatsApp, a recording pressed in Files — played at once, and the
 * player opened on them. One that is in the library is played as the
 * library's own, its history and its tags with it; any other as what its file
 * says it is (see `OpenedAudio.kt`, which reads it and keeps a copy to play).
 * Several shared at once are played one after another.
 */
export function OpenedAudio() {
  const { playQueue } = usePlayerActions();
  const openPlayer = useOpenPlayer();

  useEffect(() => {
    let live = true;
    const play = async (uris: readonly string[]) => {
      const tracks = await tracksOf(uris);
      if (!live || tracks.length === 0) return;
      await playQueue(tracks, 0);
      openPlayer();
    };
    const first = takeOpened();
    if (first.length > 0) void play(first);
    const later = JukeboxAudio.addListener('onOpenAudio', (event) => void play(event.uris ?? []));
    return () => {
      live = false;
      later.remove();
    };
  }, [playQueue, openPlayer]);

  return null;
}

/** The files the app was started with, once; none from a player without the call. Out here for the try. */
function takeOpened(): string[] {
  try {
    return JukeboxAudio.takeOpenedAudio?.() ?? [];
  } catch {
    return [];
  }
}

/** [uris] as tracks to play, in their order: the library's own where it has them, any it could not read left out. Never throws. */
async function tracksOf(uris: readonly string[]): Promise<Track[]> {
  if (!JukeboxAudio.readOpenedAudioAsync) return [];
  const read: Opened[] = [];
  for (const uri of uris) {
    try {
      read.push(await JukeboxAudio.readOpenedAudioAsync(uri));
    } catch (error) {
      console.warn('An opened file could not be read', error);
    }
  }
  // Opened with the app as it starts, the library may not have been read yet; read before it is looked in.
  if (read.some((one) => one.mediaId) && libraryState().kind !== 'library') await refreshLibrary();
  const state = libraryState();
  const library = new Map(state.kind === 'library' ? state.tracks.map((track) => [track.id, track]) : []);
  return read.map((one) => (one.mediaId ? library.get(one.mediaId) : undefined) ?? trackOf(one));
}

/**
 * A file from outside the library as a track, by what it says it is: known
 * by the media store's id where it has one, as the library would know it,
 * so that what is heard of it now is its history should it come into the
 * library; and otherwise by where it is played from.
 */
export function trackOf(opened: Opened): Track {
  return {
    id: opened.mediaId ?? `opened:${hashOf(opened.uri)}`,
    uri: opened.uri,
    title: opened.title || opened.filename || '—',
    artist: opened.artist,
    album: opened.album,
    artworkUri: null,
    durationSec: opened.durationSec > 0 ? opened.durationSec : 0,
    trackNumber: null,
    filename: opened.filename,
    folder: null,
    addedAt: null,
  };
}

/** A short name for [text] that is the same for the same text. */
function hashOf(text: string): string {
  let a = 0x811c9dc5;
  for (let at = 0; at < text.length; at += 1) a = Math.imul(a ^ text.charCodeAt(at), 0x01000193) >>> 0;
  return a.toString(36);
}
