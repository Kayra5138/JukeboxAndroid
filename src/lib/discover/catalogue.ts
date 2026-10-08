import { db } from '../db/index.ts';
import { allTags } from '../db/tags.ts';
import { knownArtistId, rememberArtistId } from '../db/discover.ts';
import { musicBrainzGet } from '../metadata/musicbrainz.ts';
import { isGenre } from '../metadata/genres.ts';
import { isAbortError } from '../metadata/http.ts';
import { strings, type Strings } from '../i18n/languages.ts';
import { ownedArtists, rankSuggestions, type Suggested } from './rank.ts';
import { foldForMatch } from '../metadata/text.ts';
import { DAY, tagFit, tagMix, tasteProfile, type Listen, type Skip } from './policy.ts';
import { similarArtists, topRecordings, coverUrl } from './listenbrainz.ts';
import type { Track } from '../types.ts';
import type { Entry } from './store.ts';

type Artist = { id: string; name: string; score?: number };
/** MusicBrainz's stand-in for a compilation's credit. It carries every tag there is and is nobody. */
const VARIOUS_ARTISTS = '89ad4ac3-39f7-470e-963a-56509c546377';
const quoted = (value: string) => `"${value.replace(/[\\"]/g, ' ')}"`;
async function resolve(name: string, now: number, signal?: AbortSignal): Promise<string | null> {
  const cached = knownArtistId(name);
  if (cached) return cached; // A cached miss must not exclude an artist forever.
  const data = await musicBrainzGet<{ artists?: Artist[] }>(`/artist/?query=${encodeURIComponent(name)}&fmt=json&limit=1`, signal);
  const first = data.artists?.[0];
  const id = first && (first.score ?? 0) >= 90 ? first.id : null;
  rememberArtistId(name, id, now);
  return id;
}

export async function buildPool(library: Track[], now: number, onProgress: (text: string) => void, signal?: AbortSignal, t: Strings = strings()): Promise<Entry[]> {
  const said = t.discover.engine;
  const tags = new Map([...allTags()].map(([id, values]) => [id, values.map(t => t.tag).filter(isGenre)]));
  const plays = db().getAllSync<Listen>('SELECT track_id,artist,started_at,seconds_played,completed FROM plays WHERE started_at >= ? AND started_at <= ?', now - 30 * DAY, now);
  const skips = db().getAllSync<Skip>('SELECT artist,started_at,seconds_played,duration_sec FROM skips WHERE started_at >= ? AND started_at <= ?', now - 30 * DAY, now);
  const profile = tasteProfile(plays, skips, tags, now);
  if (!profile.artists.length) {
    for (const name of new Set(library.map(t => t.artist).filter((n): n is string => !!n))) profile.artists.push({ name, score: 1 });
    Object.assign(profile, tagMix(library.map(track => [tags.get(track.id) ?? [], 1])));
  }
  if (!profile.artists.length) throw new Error(said.needsTaste);
  const familiar = ownedArtists([...library, ...plays]);
  const suggested: Suggested[] = [];
  const seeds: { id: string; name: string; weight: number }[] = [];
  const top = profile.artists[0].score;
  for (const seed of profile.artists.slice(0,10)) {
    onProgress(said.learning(seed.name));
    try {
      const id = await resolve(seed.name, now, signal);
      if (!id) continue;
      const weight = Math.sqrt(seed.score / top);
      seeds.push({ id, name: seed.name, weight });
      suggested.push({ seed: seed.name, weight, candidates: await similarArtists(id, signal) });
    } catch (e) { if (isAbortError(e)) throw e; }
  }
  /*
    Genre searches bring in artists outside the immediate similarity neighbourhood.

    Two tags at a time, the pairs that turn up together on what was played. One
    tag at a time was asking a catalogue for "rock", and what comes back for
    that is whoever is most famous for it, the same for everybody. Both at once
    is a few hundred artists instead of forty thousand, and they are the ones
    that sit where this listener's tastes meet. A single tag is only fallen
    back on where there are not three pairs to ask about.
  */
  const searches = profile.pairs.map(pair => ({ label: pair.join(' + '), tags: pair as string[] }));
  for (const tag of profile.tags) if (searches.length < 3) searches.push({ label: tag, tags: [tag] });
  for (const search of searches.slice(0,3)) {
    onProgress(said.exploring(search.label));
    try {
      const query = search.tags.map(tag => `tag:${quoted(tag)}`).join(' AND ');
      const response = await musicBrainzGet<{ artists?: Artist[] }>(`/artist/?query=${encodeURIComponent(query)}&fmt=json&limit=15`, signal);
      suggested.push({ seed: search.label, weight: .65, candidates: (response.artists ?? [])
        .filter(a => a.id !== VARIOUS_ARTISTS).map(a => ({ mbid: a.id, name: a.name, score: a.score ?? 0 })) });
    } catch (e) { if (isAbortError(e)) throw e; }
  }
  const ranked = rankSuggestions(suggested, new Set(), 35);
  for (const seed of seeds) {
    const existing = ranked.find(a => a.mbid === seed.id);
    if (existing) existing.score += seed.weight;
    else ranked.push({ mbid: seed.id, name: seed.name, score: seed.weight, because: [seed.name] });
  }
  const pool: Entry[] = [];
  for (const artist of ranked) {
    onProgress(said.findingSongs(artist.name));
    try {
      const songs = await topRecordings(artist.mbid, 30, signal);
      songs.forEach((song, index) => pool.push({ recordingMbid: song.mbid, title: song.title,
        artist: song.artist || artist.name, artistMbid: artist.mbid, release: song.release, coverUrl: coverUrl(song),
        because: artist.because.slice(0,2).join(' · '), familiar: familiar.has(foldForMatch(artist.name)),
        tags: song.tags, durationSec: song.durationSec,
        score: artist.score * (1 + tagFit(song.tags, profile.weights) * .3) / (1 + index * .12) }));
    } catch (e) { if (isAbortError(e)) throw e; }
  }
  if (!pool.length) throw new Error(said.nothingFetched);
  return pool;
}
