import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { downloadFor } from '../fetch.ts';
import { placementOf, type Placement } from '../placement.ts';
import { chooseRelease, matchTracks, type OwnedTrack, type Release } from '../rest.ts';
import {
  candidatesOf,
  findAlbumOnYouTube,
  searchArtist,
  songTitle,
  tracksOf,
  type Look,
} from '../youtube.ts';
import { abortError } from '../../metadata/http.ts';
import { carried, unlisted } from '../../youtube/carried.ts';
import type { YouTubeResult } from '../../youtube/types.ts';

/** A playlist as a search for playlists lists one: the phone says no more of it than this. */
const listed = (id: string, title: string, channel = ''): YouTubeResult => ({
  kind: 'playlist',
  id,
  url: `https://www.youtube.com/playlist?list=${id}`,
  title,
  channel,
  thumbnail: null,
  duration: null,
});

let made = 0;
/** A video as the reading of a playlist hands it over, the playlist it came off included. */
const video = (title: string, channel = 'Linkin Park - Topic', duration: number | null = 200): YouTubeResult => {
  const id = `v${String((made += 1)).padStart(10, '0')}`;
  return {
    id,
    url: `https://www.youtube.com/watch?v=${id}`,
    title,
    channel,
    thumbnail: null,
    duration,
    sourcePlaylist: { id: 'OLAK5uy_meteora', name: 'Album - Meteora' },
  };
};

const METEORA = ['Foreword', "Don't Stay", 'Somewhere I Belong', 'Lying From You', 'Hit the Floor', 'Easier to Run', 'Faint'];

const owned = (...titles: string[]): OwnedTrack[] =>
  titles.map((title, index) => ({ id: `t${index + 1}`, title, artist: 'Linkin Park', trackNumber: null }));

/** YouTube, as a list of answers: what a search says, what each playlist holds, and what was asked. */
function youtube(found: YouTubeResult[], held: Record<string, YouTubeResult[] | Error>) {
  const asked: string[] = [];
  const search: Look = async (query) => {
    asked.push(`search ${query}`);
    return found;
  };
  const read: Look = async (url) => {
    const id = url.split('list=')[1]!;
    asked.push(`read ${id}`);
    const answer = held[id] ?? [];
    if (answer instanceof Error) throw answer;
    return answer;
  };
  return { ask: { search, read }, asked };
}

const album = (name: string, tracks: OwnedTrack[], artist: string | null = 'Linkin Park') => ({ name, artist, tracks });

describe('a video title as the song is called', () => {
  it('loses whose it is in front, by the record\'s spelling or the channel\'s', () => {
    assert.equal(songTitle({ title: 'Linkin Park - Numb', channel: 'x' }, 'Linkin Park'), 'Numb');
    assert.equal(songTitle({ title: 'LINKIN PARK – Numb', channel: 'x' }, 'Linkin Park'), 'Numb');
    assert.equal(songTitle({ title: 'Yousei Teikoku - Filament', channel: 'Yousei Teikoku - Topic' }, '妖精帝國'), 'Filament');
    // What is in front of the dash is not the artist, so it is the song's.
    assert.equal(songTitle({ title: 'Hikaru Nara - TV Size', channel: 'x' }, 'Goose house'), 'Hikaru Nara - TV Size');
  });

  it('loses the notes about the upload, in brackets or after a dash', () => {
    for (const title of [
      'Numb (Official Audio)', 'Numb [Official Video]', 'Numb (Lyrics)', 'Numb (Visualizer)',
      'Numb (Remastered 2011)', 'Numb (2011 Remaster)', 'Numb [HD]', 'Numb (Official Music Video) [4K]',
      'Numb - Official Audio', 'Numb | Official Lyric Video', 'Linkin Park - Numb (Official Video)',
    ]) {
      assert.equal(songTitle({ title, channel: 'Linkin Park' }, 'Linkin Park'), 'Numb', title);
    }
  });

  it('keeps a bracket that is another take, another song or the song\'s own name', () => {
    for (const title of ['Numb (Live)', 'Numb (Acoustic)', 'Numb (Remix)', 'Numb (Part II)', 'Numb (feat. Jay-Z)', 'Numb (Remastered Live)', 'Numb (Demo 2002)']) {
      assert.equal(songTitle({ title, channel: 'x' }, 'Linkin Park'), title, title);
    }
    assert.equal(songTitle({ title: 'Numb (Live) [Official Video]', channel: 'x' }, 'Linkin Park'), 'Numb (Live)');
    // Nothing but a note is still a title.
    assert.equal(songTitle({ title: '(Official Audio)', channel: 'x' }, null), '(Official Audio)');
  });

  it('takes a number in front for the track\'s number only at that place in the list', () => {
    assert.equal(songTitle({ title: '07. Faint', channel: 'x' }, null, 7), 'Faint');
    assert.equal(songTitle({ title: '7 - Faint', channel: 'x' }, null, 7), 'Faint');
    assert.equal(songTitle({ title: '7 - Faint', channel: 'x' }, null, 3), '7 - Faint');
    assert.equal(songTitle({ title: '1979', channel: 'x' }, null, 1), '1979');
    assert.equal(songTitle({ title: '7 Rings', channel: 'x' }, null, 7), '7 Rings');
  });
});

describe('the tracks of a playlist', () => {
  it('are numbered in the order they play, each with its video and nothing of the playlist', () => {
    const tracks = tracksOf([video('Foreword', 'Linkin Park - Topic', 13.4), video('Linkin Park - Don\'t Stay (Official Audio)', 'Linkin Park', 188)], 'Linkin Park');
    assert.deepEqual(tracks.map((track) => [track.disc, track.position, track.title, track.lengthSec]), [
      [1, 1, 'Foreword', 13],
      [1, 2, "Don't Stay", 188],
    ]);
    assert.equal(tracks[1]!.video.title, "Linkin Park - Don't Stay (Official Audio)");
    assert.deepEqual(Object.keys(tracks[0]!.video).sort(), ['channel', 'duration', 'id', 'thumbnail', 'title', 'url']);
  });

  it('leaves out what is not a track: no length, a playlist, the whole record as one video', () => {
    const tracks = tracksOf(
      [
        video('Meteora (Full Album)', 'somebody', 2200),
        video('Foreword'),
        video('Unplayable', 'x', null),
        listed('PLx', 'A playlist inside a playlist'),
        video("Don't Stay"),
        video('Twelve hours of rain', 'x', 43200),
      ],
      'Linkin Park'
    );
    assert.deepEqual(tracks.map((track) => [track.position, track.title]), [[1, 'Foreword'], [2, "Don't Stay"]]);
  });

  it('keeps a long song among long songs', () => {
    const tracks = tracksOf([video('Part I', 'x', 1300), video('Part II', 'x', 1500), video('Part III', 'x', 900)], null);
    assert.equal(tracks.length, 3);
  });
});

describe('which playlists could be the record', () => {
  it('reads YouTube\'s own album first, then a playlist of that name, and never a mix or another thing', () => {
    const candidates = candidatesOf(
      [
        listed('RDCLAK5uy_mix', 'Meteora'),
        listed('PLfan', 'Linkin Park - Meteora (Full Album)', 'somebody'),
        listed('PLbest', 'Best of Linkin Park', 'Linkin Park'),
        listed('PLlive', 'Meteora Live Around the World', 'Linkin Park'),
        listed('PLtribute', 'Meteora - A Tribute', 'x'),
        listed('OLAK5uy_deluxe', 'Meteora (20th Anniversary Edition)', 'Linkin Park'),
        listed('OLAK5uy_album', 'Meteora', 'Linkin Park'),
        listed('OLAK5uy_album', 'Meteora', 'Linkin Park'),
        listed('PLwithin', 'my meteora favourites'),
      ],
      'Meteora',
      'Linkin Park'
    );
    assert.deepEqual(candidates.map((candidate) => candidate.id), ['OLAK5uy_album', 'OLAK5uy_deluxe', 'PLfan', 'PLwithin']);
    assert.deepEqual(candidates.map((candidate) => [candidate.own, candidate.named, candidate.credited]), [
      [true, 2, true],
      [true, 1, true],
      [false, 2, true],
      [false, 0, false],
    ]);
  });

  it('reads names as the app folds them, and an edition in the library\'s name as that edition', () => {
    const found = [listed('OLAK5uy_a', 'ŞIMARIK'), listed('OLAK5uy_b', 'Şımarık (Deluxe Edition)'), listed('OLAK5uy_c', 'Album - Simarik - Single')];
    assert.deepEqual(candidatesOf(found, 'Şımarık (Deluxe Edition)', 'Tarkan').map((candidate) => [candidate.id, candidate.named]), [
      ['OLAK5uy_b', 2],
      ['OLAK5uy_a', 1],
      ['OLAK5uy_c', 1],
    ]);
    // The search says nothing of whose a playlist is unless its name does.
    assert.equal(candidatesOf(found, 'Şımarık', 'Tarkan')[0]!.credited, false);
    assert.equal(candidatesOf([listed('PLx', 'TARKAN - Şımarık')], 'Simarik', 'Tarkan')[0]!.credited, true);
  });

  it('keeps a live record when that is what the library has', () => {
    assert.equal(candidatesOf([listed('PLx', 'Live in Texas')], 'Live in Texas', 'Linkin Park').length, 1);
  });
});

describe('who a record is searched under', () => {
  it('is its artist, or whoever most of its tracks are by', () => {
    const tracks: OwnedTrack[] = [
      { id: 'a', title: 'x', artist: 'A feat. B', trackNumber: 1 },
      { id: 'b', title: 'y', artist: 'A', trackNumber: 2 },
      { id: 'c', title: 'z', artist: 'A', trackNumber: 3 },
    ];
    assert.equal(searchArtist({ artist: 'Linkin Park', tracks }), 'Linkin Park');
    assert.equal(searchArtist({ artist: null, tracks }), 'A');
    assert.equal(searchArtist({ artist: null, tracks: [{ id: 'a', title: 'x', artist: null, trackNumber: 1 }] }), null);
  });
});

describe('looking a record up on YouTube', () => {
  const topic = (titles: string[]) => titles.map((title) => video(title));

  it('searches once, under the artist and the name without its edition, and reads the album', async () => {
    const { ask, asked } = youtube(
      [listed('PLfan', 'Linkin Park - Meteora (Full Album)', 'somebody'), listed('OLAK5uy_album', 'Meteora')],
      { OLAK5uy_album: topic(METEORA), PLfan: topic(METEORA) }
    );
    const stages: string[] = [];
    const found = await findAlbumOnYouTube(album('Meteora (Deluxe Edition)', owned('Faint', 'Hit The Floor', 'Numb')), ask, {
      onStage: (stage) => stages.push(stage),
    });

    assert.deepEqual(asked, ['search Linkin Park Meteora', 'read OLAK5uy_album']);
    assert.deepEqual(stages, ['searching', 'reading']);
    assert.ok(found.ok);
    assert.equal(found.album.by, 'tracks');
    assert.equal(found.album.covered, 2);
    assert.deepEqual(found.album.playlist, {
      id: 'OLAK5uy_album',
      url: 'https://www.youtube.com/playlist?list=OLAK5uy_album',
      title: 'Meteora',
      // The search gave none, so whoever the videos are by.
      channel: 'Linkin Park',
    });
    assert.deepEqual(found.album.tracks.map((track) => [track.position, track.title, track.have]), [
      [1, 'Foreword', null],
      [2, "Don't Stay", null],
      [3, 'Somewhere I Belong', null],
      [4, 'Lying From You', null],
      [5, 'Hit the Floor', 't2'],
      [6, 'Easier to Run', null],
      [7, 'Faint', 't1'],
    ]);
  });

  it('passes over a playlist the library\'s tracks are not on, and stops at the first they are', async () => {
    const { ask, asked } = youtube(
      [listed('OLAK5uy_other', 'Meteora', 'Somebody Else'), listed('PLfan', 'Linkin Park - Meteora', 'a fan'), listed('PLthird', 'Meteora full')],
      {
        OLAK5uy_other: [video('One', 'Somebody Else - Topic'), video('Two', 'Somebody Else - Topic')],
        PLfan: METEORA.map((title, index) => video(`Linkin Park - ${title} (Official Audio)`, index % 2 ? 'a fan' : 'Linkin Park')),
        PLthird: topic(METEORA),
      }
    );
    const found = await findAlbumOnYouTube(album('Meteora', owned('Faint', 'Foreword', 'Easier To Run')), ask);

    assert.deepEqual(asked, ['search Linkin Park Meteora', 'read OLAK5uy_other', 'read PLfan']);
    assert.ok(found.ok);
    assert.equal(found.album.playlist.id, 'PLfan');
    assert.equal(found.album.covered, 3);
    assert.equal(found.album.tracks[6]!.title, 'Faint');
  });

  it('reads three at the most, and says not found sooner than guess', async () => {
    const wrong = () => [video('One'), video('Two'), video('Three')];
    const { ask, asked } = youtube(
      [listed('OLAK5uy_1', 'Meteora'), listed('OLAK5uy_2', 'Meteora'), listed('PL3', 'Meteora'), listed('PL4', 'Meteora')],
      { OLAK5uy_1: wrong(), OLAK5uy_2: wrong(), PL3: wrong(), PL4: topic(METEORA) }
    );
    const found = await findAlbumOnYouTube(album('Meteora', owned('Faint', 'Foreword', 'Numb')), ask);

    assert.deepEqual(found, { ok: false, why: 'notFound' });
    assert.deepEqual(asked, ['search Linkin Park Meteora', 'read OLAK5uy_1', 'read OLAK5uy_2', 'read PL3']);
  });

  it('wants half the library\'s tracks, and never one of three', async () => {
    const { ask } = youtube([listed('OLAK5uy_album', 'Meteora', 'Linkin Park')], { OLAK5uy_album: topic(METEORA) });
    assert.deepEqual(await findAlbumOnYouTube(album('Meteora', owned('Faint', 'Numb', 'Breaking the Habit')), ask), {
      ok: false,
      why: 'notFound',
    });
    const half = await findAlbumOnYouTube(album('Meteora', owned('Faint', 'Foreword', 'Numb', 'Session')), ask);
    assert.ok(half.ok && half.album.covered === 2);
  });

  it('does not take one shared title for the record unless something says whose the playlist is', async () => {
    const mine = album('Meteora', owned('Foreword'));
    const stranger = youtube([listed('PLx', 'Meteora')], { PLx: [video('Foreword', 'a stranger'), video('Else', 'a stranger')] });
    assert.deepEqual(await findAlbumOnYouTube(mine, stranger.ask), { ok: false, why: 'notFound' });

    const theirs = youtube([listed('PLx', 'Meteora')], { PLx: topic(METEORA) });
    const found = await findAlbumOnYouTube(mine, theirs.ask);
    assert.ok(found.ok && found.album.by === 'tracks');
  });

  it('takes YouTube\'s one album of the name on trust where the library has a track or two, and says so', async () => {
    // The library's only track is there under a title that cannot be read as it.
    const mine = album('Meteora', owned('05 hit_the_floor_final'));
    const one = youtube(
      [listed('PLfan', 'Linkin Park - Meteora', 'a fan'), listed('OLAK5uy_album', 'Meteora')],
      { OLAK5uy_album: topic(METEORA), PLfan: topic(METEORA) }
    );
    const found = await findAlbumOnYouTube(mine, one.ask);
    assert.ok(found.ok);
    assert.equal(found.album.by, 'album');
    assert.equal(found.album.covered, 0);
    assert.deepEqual(one.asked, ['search Linkin Park Meteora', 'read OLAK5uy_album']);

    // Two albums of the name: neither is "the" album.
    const two = youtube(
      [listed('OLAK5uy_album', 'Meteora'), listed('OLAK5uy_deluxe', 'Meteora (Deluxe Edition)')],
      { OLAK5uy_album: topic(METEORA), OLAK5uy_deluxe: topic(METEORA) }
    );
    assert.deepEqual(await findAlbumOnYouTube(mine, two.ask), { ok: false, why: 'notFound' });

    // Somebody else's album of the name.
    const theirs = youtube([listed('OLAK5uy_album', 'Meteora')], { OLAK5uy_album: [video('One', 'Somebody Else - Topic')] });
    assert.deepEqual(await findAlbumOnYouTube(mine, theirs.ask), { ok: false, why: 'notFound' });

    // A fan's playlist is never taken on trust.
    const fan = youtube([listed('PLfan', 'Linkin Park - Meteora', 'Linkin Park')], { PLfan: topic(METEORA) });
    assert.deepEqual(await findAlbumOnYouTube(mine, fan.ask), { ok: false, why: 'notFound' });

    // And not for a library with enough tracks to have checked.
    const enough = album('Meteora', owned('a', 'b', 'c'));
    assert.deepEqual(await findAlbumOnYouTube(enough, one.ask), { ok: false, why: 'notFound' });
  });

  it('is not a record past a length no record has', async () => {
    const everything = Array.from({ length: 151 }, (_, index) => video(index < 7 ? METEORA[index]! : `Song ${index}`));
    const { ask } = youtube([listed('PLall', 'Meteora', 'Linkin Park')], { PLall: everything });
    assert.deepEqual(await findAlbumOnYouTube(album('Meteora', owned('Faint', 'Foreword')), ask), { ok: false, why: 'notFound' });
  });

  it('searches under the commonest artist where the record has no one artist, and needs a name', async () => {
    const tracks = [...owned('Faint', 'Foreword'), { id: 'g', title: 'Numb', artist: 'Linkin Park & Jay-Z', trackNumber: null }];
    const { ask, asked } = youtube([listed('OLAK5uy_album', 'Meteora')], { OLAK5uy_album: topic(METEORA) });
    const found = await findAlbumOnYouTube(album('Meteora', tracks, null), ask);
    assert.ok(found.ok);
    assert.equal(asked[0], 'search Linkin Park Meteora');

    const nobody = youtube([], {});
    const anonymous = owned('Faint').map((track) => ({ ...track, artist: null }));
    assert.deepEqual(await findAlbumOnYouTube(album('Meteora', anonymous, null), nobody.ask), { ok: false, why: 'unnamed' });
    assert.deepEqual(await findAlbumOnYouTube(album('  ', owned('Faint')), nobody.ask), { ok: false, why: 'unnamed' });
    assert.deepEqual(nobody.asked, []);
  });

  it('answers a failure with what YouTube said, goes past a playlist that has been taken down, and passes a stop on', async () => {
    const refused = Object.assign(new Error('Sign in to confirm'), { code: 'ERR_YOUTUBE_REFUSED' });
    const gone = Object.assign(new Error('unavailable'), { code: 'ERR_YOUTUBE_UNAVAILABLE' });
    const mine = album('Meteora', owned('Faint', 'Foreword'));

    const failing: Look = async () => { throw refused; };
    assert.deepEqual(await findAlbumOnYouTube(mine, { search: failing, read: failing }), { ok: false, why: 'failed', error: refused });

    const found = [listed('OLAK5uy_gone', 'Meteora'), listed('PLfan', 'Linkin Park - Meteora')];
    const next = youtube(found, { OLAK5uy_gone: gone, PLfan: topic(METEORA) });
    const second = await findAlbumOnYouTube(mine, next.ask);
    assert.ok(second.ok && second.album.playlist.id === 'PLfan');

    const midway = youtube(found, { OLAK5uy_gone: refused, PLfan: topic(METEORA) });
    assert.deepEqual(await findAlbumOnYouTube(mine, midway.ask), { ok: false, why: 'failed', error: refused });
    assert.deepEqual(midway.asked, ['search Linkin Park Meteora', 'read OLAK5uy_gone']);

    const controller = new AbortController();
    const stopping: Look = async () => { controller.abort(); throw new Error('Cancelled'); };
    await assert.rejects(findAlbumOnYouTube(mine, { search: stopping, read: stopping }, { signal: controller.signal }), /Cancelled/);
    const aborting: Look = async () => { throw abortError(); };
    await assert.rejects(findAlbumOnYouTube(mine, { search: aborting, read: aborting }));
  });
});

describe('one comparison with the library, whichever list it is fed', () => {
  it('says the same of the same record read off a pressing and off a playlist', () => {
    const mine: OwnedTrack[] = [
      { id: 'a', title: 'Linkin Park - Faint', artist: 'Linkin Park', trackNumber: 7 },
      { id: 'b', title: 'Hit the Floor (2011 Remaster)', artist: 'Linkin Park', trackNumber: null },
      { id: 'c', title: 'Foreword (Live)', artist: 'Linkin Park', trackNumber: null },
    ];
    const release: Release = {
      id: 'r',
      status: 'Official',
      media: [{ position: 1, tracks: METEORA.map((title, index) => ({ position: index + 1, title })) }],
    };
    const pressed = chooseRelease([release], mine)!;
    const played = tracksOf(METEORA.map((title) => video(`Linkin Park - ${title} (Official Audio)`, 'Linkin Park')), 'Linkin Park');

    assert.deepEqual(matchTracks(played, mine), pressed.held);
    // The live take is not the album's opening track, off either.
    assert.deepEqual(pressed.held, [null, null, null, null, 'b', null, 'a']);
  });
});

describe('downloading a track off the playlist', () => {
  const place: Placement = { album: 'Meteora', title: 'Faint', artist: 'Linkin Park', track: 7, disc: null, year: 2003, genre: 'Rock' };

  it('is an ordinary download of that video with the place it is for, and of no playlist', () => {
    const [track] = tracksOf([video('Linkin Park - Faint (Official Video)', 'Linkin Park', 162)], 'Linkin Park');
    const asked = downloadFor(track!.video, place);

    assert.deepEqual(asked, {
      id: track!.video.id,
      url: track!.video.url,
      title: 'Linkin Park - Faint (Official Video)',
      channel: 'Linkin Park',
      thumbnail: null,
      duration: 162,
      discoveryTitle: 'Faint',
      discoveryArtist: 'Linkin Park',
      placement: place,
    });
    assert.equal('find' in asked, false);
    assert.deepEqual(placementOf(carried(asked)), place);
  });

  it('does not say whose it is where the record has no one artist', () => {
    const asked = downloadFor(video('Faint') as never, { ...place, artist: null });
    assert.equal('discoveryArtist' in asked, false);
    // Even handed a video straight off the playlist, it names none.
    assert.equal('sourcePlaylist' in asked, false);
  });

  it('are sent in the record\'s order, and none of them as part of a list', () => {
    const tracks = tracksOf(METEORA.map((title) => video(title)), 'Linkin Park');
    const sent = tracks.map((track) => carried(unlisted(downloadFor(track.video, { ...place, title: track.title, track: track.position }))));
    assert.deepEqual(sent.map((one) => placementOf(one)!.track), [1, 2, 3, 4, 5, 6, 7]);
    assert.deepEqual(sent.map((one) => one.discoveryTitle), METEORA);
    assert.ok(sent.every((one) => !('sourcePlaylist' in one)));
  });
});
