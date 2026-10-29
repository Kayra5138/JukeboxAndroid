import { useSyncExternalStore } from 'react';

import JukeboxAudio from '../../../modules/jukebox-audio/index.ts';
import { createStore } from '../ui/store.ts';
import { downloads } from '../youtube/native.ts';
import { tapeFlag } from './settings.ts';

/**
 * What a tape comes with beyond its sound, made ready as it comes on: its
 * chapters, kept as it was fetched or, for one fetched before that was done,
 * looked up once by its video; and, for a video, the parts SponsorBlock's
 * listeners marked to pass over, handed to the player, which passes over them.
 */

export type Chapter = { startSec: number; title: string };

const chapters = createStore<ReadonlyMap<string, readonly Chapter[]>>(new Map());
const NONE: readonly Chapter[] = [];

/**
 * Where each tape that has come on can have what is said in it read from:
 * the video it was fetched from, '' for one with a transcript kept already
 * (a podcast's episode, from its feed), or null for neither.
 */
const videos = createStore<ReadonlyMap<string, string | null>>(new Map());

export type TranscriptLine = { startSec: number; text: string };
/** Each tape's captions as they stand: being read, read (none, for a video without), or not asked for. */
const transcripts = createStore<ReadonlyMap<string, { lines: readonly TranscriptLine[] | null; looking: boolean }>>(new Map());

/** The video of YouTube's [trackId] was fetched from, or null for a file fetched as it is, or put there by hand. */
async function videoOf(trackId: string): Promise<string | null> {
  const jobs = (await downloads?.getJobsAsync(false)) ?? [];
  const job = jobs.filter((one) => one.trackId === trackId && one.status === 'done').pop();
  return job && !job.video.direct ? job.video.id : null;
}

async function readChapters(trackId: string, video: string | null, uri: string | null): Promise<void> {
  let found = (await JukeboxAudio.getTapeChaptersAsync?.(trackId)) ?? [];
  if (found.length === 0 && video) found = (await JukeboxAudio.lookUpTapeChaptersAsync?.(trackId, video)) ?? [];
  // A file of its own may have them written into it, as many podcasts' episodes do: read once, found or not.
  else if (found.length === 0 && uri) found = (await JukeboxAudio.readEmbeddedChaptersAsync?.(trackId, uri)) ?? [];
  chapters.set(new Map(chapters.get()).set(trackId, found));
}

/** The tapes whose parts to pass over could not be looked up the last time: said on their details. */
const skipTrouble = createStore<ReadonlyMap<string, true>>(new Map());

async function readSkips(trackId: string, video: string): Promise<void> {
  // Not asked at all with the switch off: SponsorBlock hears of no tape somebody did not want passed over.
  if (!tapeFlag('skipSponsors')) return;
  if (JukeboxAudio.tapeSkipsKnown?.(trackId) !== false) return;
  try {
    // Asked by the player, which keeps the answer: none marked is an answer too, and is not asked again.
    if (!JukeboxAudio.lookUpTapeSkipsAsync) return;
    await JukeboxAudio.lookUpTapeSkipsAsync(trackId, video);
    if (skipTrouble.get().has(trackId)) {
      const next = new Map(skipTrouble.get());
      next.delete(trackId);
      skipTrouble.set(next);
    }
  } catch (error) {
    console.warn('SponsorBlock could not be asked', error);
    skipTrouble.set(new Map(skipTrouble.get()).set(trackId, true));
  }
}

/** Whether [trackId]'s parts to pass over could not be looked up the last time it came on. */
export function useSkipTrouble(trackId: string): boolean {
  return useSyncExternalStore(skipTrouble.subscribe, skipTrouble.get).get(trackId) ?? false;
}

/** The YouTube tape that came on last, for the switch for sponsors turned on while it plays. */
let lastVideo: { trackId: string; video: string } | null = null;

/** The switch for passing over sponsors turned on: the tape playing, if one of YouTube's, has its parts looked up now. */
export function sponsorsTurnedOn(): void {
  const tape = lastVideo;
  if (!tape) return;
  // Only while it is still the one in the player: music since is no tape to ask about.
  void JukeboxAudio.getStatusAsync()
    .then((status) => {
      if (status.trackId === tape.trackId) return readSkips(tape.trackId, tape.video);
    })
    .catch(() => {});
}

/** [trackId], a tape that has come on from [uri], made ready. Never throws. */
export async function prepareTape(trackId: string, uri: string | null = null): Promise<void> {
  try {
    const video = await videoOf(trackId);
    const kept = !video && JukeboxAudio.tapeTranscriptKept?.(trackId) === true;
    videos.set(new Map(videos.get()).set(trackId, video ?? (kept ? '' : null)));
    lastVideo = video ? { trackId, video } : null;
    await Promise.allSettled([readChapters(trackId, video, uri), video ? readSkips(trackId, video) : Promise.resolve()]);
  } catch (error) {
    console.warn('A tape could not be made ready', error);
  }
}

/** [trackId]'s chapters, in order; none until it has come on, or where it has none. */
export function useChapters(trackId: string | null): readonly Chapter[] {
  const all = useSyncExternalStore(chapters.subscribe, chapters.get);
  return (trackId ? all.get(trackId) : undefined) ?? NONE;
}

/** Where [trackId] can have what is said in it read from, once it has come on: its video, '' for a transcript kept, null for neither or not yet known. */
export function useTapeVideo(trackId: string | null): string | null {
  const all = useSyncExternalStore(videos.subscribe, videos.get);
  return (trackId ? all.get(trackId) : null) ?? null;
}

/** [trackId]'s captions read, once: kept, or else from the video it was fetched from ('' for none). Never throws. */
export async function readTranscript(trackId: string, video: string): Promise<void> {
  const now = transcripts.get().get(trackId);
  if (now?.looking || now?.lines) return;
  transcripts.set(new Map(transcripts.get()).set(trackId, { lines: null, looking: true }));
  let lines: readonly TranscriptLine[] | null = null;
  try {
    lines = (await JukeboxAudio.lookUpTapeTranscriptAsync?.(trackId, video)) ?? [];
  } catch (error) {
    console.warn('The captions could not be read', error);
  }
  transcripts.set(new Map(transcripts.get()).set(trackId, { lines, looking: false }));
}

const NOT_ASKED = { lines: null, looking: false } as const;

/** [trackId]'s captions as they stand. */
export function useTranscript(trackId: string | null): { lines: readonly TranscriptLine[] | null; looking: boolean } {
  const all = useSyncExternalStore(transcripts.subscribe, transcripts.get);
  return (trackId ? all.get(trackId) : undefined) ?? NOT_ASKED;
}

/** Which of [list] [positionSec] is in, by its place; -1 before the first. */
export function chapterAt(list: readonly Chapter[], positionSec: number): number {
  let at = -1;
  for (let index = 0; index < list.length; index += 1) if (list[index]!.startSec <= positionSec + 0.25) at = index;
  return at;
}
