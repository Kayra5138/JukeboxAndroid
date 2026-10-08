import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { armFinder, awaitsFinding, finderRunning, findUntil, findWhileWaiting, kickFinder, queueChanged } from '../finder.ts';
import type { DownloadJob, YouTubeVideo } from '../types.ts';

const named = (id: string, title: string, more: Partial<DownloadJob> = {}): DownloadJob => ({
  id,
  video: {
    id: '', url: '', title, channel: 'Linkin Park', thumbnail: null, duration: null,
    find: { query: `Linkin Park ${title} official audio`, artist: 'Linkin Park', title, durationSec: 162 },
  },
  format: 'mp3', folder: 'Music', status: 'queued', progress: 0, trackId: null, error: null, described: false,
  ...more,
});
const video = (title: string, duration = 162): YouTubeVideo => ({
  id: `id-${title}`, url: '', title, channel: 'Linkin Park', duration, thumbnail: null,
});

/** A phone that hands out `waiting` in order, one at a time, and remembers what it was told. */
function phone(waiting: DownloadJob[], results: (query: string) => YouTubeVideo[] | Error) {
  const said: string[] = [];
  const resolved = new Map<string, YouTubeVideo | null>();
  let finding: string | null = null;
  return {
    said,
    resolved,
    waiting,
    claimFindAsync: async () => {
      if (finding) return null;
      const job = waiting.shift() ?? null;
      finding = job?.id ?? null;
      if (job) said.push(`claim ${job.id}`);
      return job;
    },
    findSearchAsync: async (query: string, searchId: string) => {
      said.push(`search ${searchId}`);
      assert.equal(searchId, finding);
      await new Promise((resolve) => setImmediate(resolve));
      const found = results(query);
      if (found instanceof Error) {
        // As the phone does: the job has been failed, and is nobody's any more.
        finding = null;
        throw found;
      }
      return found;
    },
    resolveFindAsync: async (id: string, found: YouTubeVideo | null) => {
      assert.equal(id, finding);
      finding = null;
      resolved.set(id, found);
    },
    getJobsAsync: async () => [...waiting],
    queueStateAsync: async () => ({ paused: false }),
  };
}

describe('finding the video for a job asked for by name', () => {
  it('claims, searches, chooses and says which, one job after another', async () => {
    const native = phone([named('a', 'Faint'), named('b', 'Numb')], (query) =>
      query.includes('Faint')
        ? [video('Linkin Park - Faint (Live in Texas)'), video('Linkin Park - Faint (Official Audio)')]
        : [video('Linkin Park - Numb')]
    );
    let told = 0;
    assert.equal(await findWhileWaiting(native, { changed: () => (told += 1) }), 2);
    assert.deepEqual(native.said, ['claim a', 'search a', 'claim b', 'search b']);
    assert.equal(native.resolved.get('a')?.title, 'Linkin Park - Faint (Official Audio)');
    assert.equal(native.resolved.get('b')?.title, 'Linkin Park - Numb');
    // Taken and settled, for each.
    assert.equal(told, 4);
  });

  it('says none rather than the wrong recording', async () => {
    const native = phone([named('a', 'Faint')], () => [video('Linkin Park - Faint', 330), video('Linkin Park - Faint (cover)')]);
    await findWhileWaiting(native);
    assert.equal(native.resolved.get('a'), null);
  });

  it('a search that fails is the phone\'s to write down, and the next job is still looked for', async () => {
    const refused = Object.assign(new Error('refused'), { code: 'ERR_YOUTUBE_REFUSED' });
    const native = phone([named('a', 'Faint'), named('b', 'Numb')], (query) =>
      query.includes('Faint') ? refused : [video('Linkin Park - Numb')]
    );
    assert.equal(await findWhileWaiting(native), 2);
    assert.equal(native.resolved.has('a'), false);
    assert.equal(native.resolved.get('b')?.title, 'Linkin Park - Numb');
  });

  it('stops between jobs when told to, and sees through the one it has', async () => {
    const native = phone([named('a', 'Faint'), named('b', 'Numb')], () => []);
    let stop = false;
    const run = findWhileWaiting(native, { stopped: () => stop, changed: () => (stop = true) });
    assert.equal(await run, 1);
    assert.equal(native.resolved.has('a'), true);
    assert.equal(native.waiting.length, 1);
  });

  it('asks again when the phone says "not yet", for as long as a name is waiting', async () => {
    const job = named('a', 'Faint');
    const native = phone([], () => [video('Linkin Park - Faint')]);
    let asked = 0;
    let time = 0;
    const slow = {
      ...native,
      // Held for its twenty-five seconds twice, then the name's turn comes.
      claimFindAsync: async () => { asked += 1; time += 25_000; return asked < 3 ? null : native.claimFindAsync(); },
      getJobsAsync: async () => (native.resolved.has('a') ? [] : [job]),
    };
    native.waiting.push(job);
    assert.equal(await findWhileWaiting(slow, {}, () => time), 1);
    // Twice put off, once given it, and once more to be told there is no more.
    assert.equal(asked, 4);
    assert.equal(native.resolved.get('a')?.title, 'Linkin Park - Faint');
  });

  it('stops asking when no name is waiting, and when the queue is paused', async () => {
    let asked = 0;
    const idle = { claimFindAsync: async () => { asked += 1; return null; }, findSearchAsync: async () => [], resolveFindAsync: async () => {},
      getJobsAsync: async () => [named('d', 'Faint', { status: 'downloading' })], queueStateAsync: async () => ({ paused: false }) };
    let told = 0;
    assert.equal(await findWhileWaiting(idle, { changed: () => (told += 1) }), 0);
    assert.equal(asked, 1);
    // Nothing changed, so nobody is told to read anything again.
    assert.equal(told, 0);

    asked = 0;
    const paused = { ...idle, getJobsAsync: async () => [named('a', 'Faint')], queueStateAsync: async () => ({ paused: true }) };
    await findWhileWaiting(paused);
    assert.equal(asked, 1);
  });

  it('does not spin on a phone that answers "none" at once with names waiting', async () => {
    let asked = 0;
    const native = { claimFindAsync: async () => { asked += 1; return null; }, findSearchAsync: async () => [], resolveFindAsync: async () => {},
      getJobsAsync: async () => [named('a', 'Faint')] };
    await findWhileWaiting(native, {}, () => 0);
    assert.equal(asked, 3);
  });

  it('does nothing on a build that cannot be asked', async () => {
    assert.equal(await findWhileWaiting({ getJobsAsync: async () => [named('a', 'Faint')] }), 0);
  });

  it('knows a job that is waiting to be looked for from one that is not', () => {
    assert.equal(awaitsFinding(named('a', 'Faint')), true);
    assert.equal(awaitsFinding(named('a', 'Faint', { status: 'finding' })), false);
    assert.equal(awaitsFinding(named('a', 'Faint', { status: 'failed' })), false);
    const found = named('a', 'Faint');
    delete found.video.find;
    assert.equal(awaitsFinding(found), false);
  });
});

describe('the background task finding its own', () => {
  const none = { findSearchAsync: async () => [], resolveFindAsync: async () => {} };

  it('goes on asking until its job has had its turn', async () => {
    const target = named('t', 'Numb', { automatic: true });
    const held = [target];
    const resolved = new Map<string, YouTubeVideo | null>();
    let asked = 0;
    // Not its turn the first two times: Discover's own wait for quiet.
    const native = {
      claimFindAsync: async () => ((asked += 1) < 3 ? null : (held.shift() ?? null)),
      findSearchAsync: async () => [video('Linkin Park - Numb')],
      resolveFindAsync: async (id: string, found: YouTubeVideo | null) => { resolved.set(id, found); },
      getJobsAsync: async () => [...held],
    };
    let pauses = 0;
    await findUntil(native, 't', 10_000, async () => { pauses += 1; }, () => 0);
    assert.equal(pauses, 2);
    assert.equal(resolved.get('t')?.title, 'Linkin Park - Numb');
  });

  it('gives up when the time is up, leaving the job as it is', async () => {
    const target = named('t', 'Numb', { automatic: true });
    let time = 0;
    let asked = 0;
    const native = { ...none, claimFindAsync: async () => { asked += 1; time += 25_000; return null; }, getJobsAsync: async () => [target] };
    let pauses = 0;
    await findUntil(native, 't', 60_000, async () => { pauses += 1; }, () => time);
    assert.equal(asked, 3);
    // Each question was held its time: no need to wait between them.
    assert.equal(pauses, 0);
  });

  it('gives up at once behind anything somebody asked for, which only the app can fetch', async () => {
    const target = named('t', 'Numb', { automatic: true });
    for (const ahead of [named('d', 'Faint'), named('e', 'Faint', { status: 'downloading' })]) {
      let asked = 0;
      const native = { ...none, claimFindAsync: async () => { asked += 1; return null; }, getJobsAsync: async () => [target, ahead] };
      await findUntil(native, 't', 60_000, async () => {}, () => 0);
      assert.equal(asked, 0);
    }
  });

  it('gives up at once while the queue is paused', async () => {
    const target = named('t', 'Numb', { automatic: true });
    let asked = 0;
    const native = { ...none, claimFindAsync: async () => { asked += 1; return null; }, getJobsAsync: async () => [target], queueStateAsync: async () => ({ paused: true }) };
    await findUntil(native, 't', 60_000, async () => {}, () => 0);
    assert.equal(asked, 0);
  });

  it('is not held up by what has finished, or by others of Discover\'s own', async () => {
    const target = named('t', 'Numb', { automatic: true });
    const others = [named('x', 'Faint', { status: 'done' }), named('y', 'Faint', { status: 'failed' }), named('z', 'Faint', { automatic: true })];
    let asked = 0;
    let time = 0;
    const native = { ...none, claimFindAsync: async () => { asked += 1; time += 25_000; return null; }, getJobsAsync: async () => [target, ...others] };
    await findUntil(native, 't', 20_000, async () => {}, () => time);
    assert.equal(asked, 1);
  });
});

describe('the app\'s one finder', () => {
  const tick = () => new Promise((resolve) => setImmediate(resolve));

  it('runs for whoever is armed, once at a time, and not at all for nobody', async () => {
    const native = phone([named('a', 'Faint'), named('b', 'Numb')], () => []);
    kickFinder();
    assert.equal(native.said.length, 0);

    let settled: () => void = () => {};
    const done = new Promise<void>((resolve) => { settled = resolve; });
    const disarm = armFinder(native, { changed: () => { if (native.resolved.size === 2) settled(); } });
    kickFinder();
    kickFinder();
    assert.equal(finderRunning(), true);
    await done;
    assert.deepEqual(native.said, ['claim a', 'search a', 'claim b', 'search b']);
    for (let i = 0; i < 5; i += 1) await tick();
    // No name left: it has stopped of its own accord.
    assert.equal(finderRunning(), false);

    disarm();
    native.waiting.push(named('c', 'Faint'));
    kickFinder();
    await tick();
    assert.equal(native.waiting.length, 1);
  });

  it('a claim that comes back empty tells nobody anything, and the finder is free to be set going again', async () => {
    let asked = 0;
    let told = 0;
    const native = { claimFindAsync: async () => { asked += 1; return null; }, findSearchAsync: async () => [], resolveFindAsync: async () => {},
      getJobsAsync: async () => [], queueStateAsync: async () => ({ paused: false }) };
    const disarm = armFinder(native, { changed: () => (told += 1) });
    kickFinder();
    for (let i = 0; i < 5; i += 1) await tick();
    assert.equal(asked, 1);
    assert.equal(told, 0);
    assert.equal(finderRunning(), false);
    kickFinder();
    for (let i = 0; i < 5; i += 1) await tick();
    assert.equal(asked, 2);
    disarm();
  });

  it('whoever changes the queue from outside has it read again, and only where somebody reads it', () => {
    queueChanged();
    let read = 0;
    const disarm = armFinder({ getJobsAsync: async () => [] }, {}, () => (read += 1));
    queueChanged();
    queueChanged();
    assert.equal(read, 2);
    disarm();
    queueChanged();
    assert.equal(read, 2);
  });
});
