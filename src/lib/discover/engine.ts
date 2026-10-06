import { db } from '../db/index';
import { saveLookupTags } from '../db/tags';
import { youtubeError } from '../youtube/errors';
import { downloads } from '../youtube/native';
import { withMetadata } from '../media/merge';
import { scanLibrary, libraryRoot } from '../media/library';
import { isActive, type DownloadJob } from '../youtube/types';
import { DAY, DEFAULT_SETTINGS, NO_MATCH, batchReady, isNoMatch, retirementIds, selectSongs, songKey, type DiscoverSettings } from './policy';
import { buildPool } from './catalogue';
import { chooseVideo } from './video';
import { readSnapshot, saveSnapshot, readDiscoverSettings, saveDiscoverSettings, exclude, exclusions, unblock, type Entry, type Snapshot } from './store';
import type { Track } from '../types';

// One coordinator for screens and the background task; mutations are serialized.
let snapshot: Snapshot | null = null;
let settings: DiscoverSettings | null = null;
let view = { snapshot: null as Snapshot | null, settings: readDefaults(), busy: false, message: '', waiting: '', error: '', jobs: [] as DownloadJob[] };
function readDefaults(): DiscoverSettings { return { ...DEFAULT_SETTINGS }; }
const listeners = new Set<() => void>();
let serial: Promise<unknown> = Promise.resolve();
let maintenance: Promise<void> | null = null;
let protectedIds: string[] = [];
let lastAttempt = 0;
const undoEntries = new Map<string, Entry>();
function init() { snapshot ??= readSnapshot(); settings ??= readDiscoverSettings(); }
function emit(patch: Partial<typeof view> = {}) {
  init(); view = { ...view, snapshot: { ...snapshot! }, settings: { ...settings! }, ...patch };
  listeners.forEach(fn => fn());
}
function commit() { saveSnapshot(snapshot!); emit(); }
function transaction(change: () => void) {
  const before = JSON.parse(JSON.stringify(snapshot)) as Snapshot;
  try { db().withTransactionSync(() => { change(); saveSnapshot(snapshot!); }); }
  catch (error) { snapshot = before; throw error; }
  emit();
}
function exclusive<T>(action: () => Promise<T>): Promise<T> {
  const next = serial.then(async () => { init(); return action(); });
  serial = next.catch(() => {}); return next;
}
export const subscribeDiscover = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const discoverView = () => view;
export function protectDiscoverQueue(queue: Track[]) { protectedIds = queue.map(t => t.id); }
export const discoverError = (e: unknown) => {
  const message = e instanceof Error ? e.message : '';
  return /Call to function|Caused by:|java\./i.test(message)
    ? youtubeError(e, 'This download could not finish. Please retry later.')
    : message || 'Discover could not finish. Please retry.';
};

async function sync() {
  if (!downloads) return;
  const jobs = (await downloads.getJobsAsync(true)).filter(j => !!j.discoverKey);
  const excluded = exclusions();
  snapshot!.entries = snapshot!.entries.filter(entry => {
    if (!excluded.has(entry.recordingMbid) && !excluded.has(songKey(entry))) return true;
    if (entry.jobId) snapshot!.retired.push(entry.jobId);
    return false;
  });
  if (snapshot!.pending) snapshot!.pending = snapshot!.pending.filter(entry => {
    if (!excluded.has(entry.recordingMbid) && !excluded.has(songKey(entry))) return true;
    if (entry.jobId) snapshot!.retired.push(entry.jobId);
    return false;
  });
  // Reattach receipts after process death between native enqueue and JS persistence.
  for (const entry of [...snapshot!.entries, ...(snapshot!.pending ?? [])]) {
    const job = jobs.find(j => j.id === entry.jobId) ?? jobs.find(j => !snapshot!.retired.includes(j.id) && j.discoverKey === entry.recordingMbid && (j.status === 'done' || isActive(j)));
    if (!job) { if (entry.jobId) { entry.jobId = undefined; entry.track = undefined; } continue; }
    entry.jobId = job.id;
    if (job.status === 'done') {
      const wasReady = !!entry.track;
      entry.track = await downloads.discoverTrackAsync(job.id) ?? undefined;
      if (!wasReady && entry.track && entry.tags?.length) saveLookupTags(entry.track.id, entry.tags, 'musicbrainz');
      entry.error = entry.track ? undefined : 'File missing. Tap to download again.';
    }
    else { entry.track = undefined; entry.error = job.status === 'failed' || job.status === 'missing' || job.status === 'cancelled' ? job.error ?? 'Download stopped. Tap to retry.' : undefined; }
  }
  const live = [...snapshot!.entries, ...(snapshot!.pending ?? [])].map(e => e.jobId);
  const retired = new Set(retirementIds(snapshot!.retired, jobs, live));
  for (const id of retired) if (jobs.some(j => j.id === id && isActive(j))) await downloads.cancelAsync(id);
  const removed = new Set(await downloads.cleanDiscoverAsync([...retired], protectedIds));
  snapshot!.retired = [...retired].filter(id => !removed.has(id));
  saveSnapshot(snapshot!); emit({ jobs });
}
async function fill(refresh: boolean) {
  const library = withMetadata(await scanLibrary()); // A permission failure must not pretend the library is empty.
  const excluded = exclusions();
  library.forEach(t => excluded.add(songKey(t)));
  if (refresh) snapshot!.entries.forEach(e => { excluded.add(e.recordingMbid); excluded.add(songKey(e)); });
  const retained = refresh ? [] : snapshot!.entries;
  let entries = selectSongs(snapshot!.pool, retained, settings!.count, excluded);
  if (refresh || entries.length < settings!.count) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2 * 60_000);
    let pool: Entry[];
    try { pool = await buildPool(library, Date.now(), message => emit({ message }), controller.signal); }
    finally { clearTimeout(timeout); }
    entries = selectSongs(pool, retained, settings!.count, excluded);
    // Keep the old batch if a refresh could not deliver anything usable.
    if (refresh && entries.length < Math.min(settings!.count, snapshot!.entries.length || 1)) {
      throw new Error('Not enough new songs are available yet. Your current list has been kept.');
    }
    snapshot!.pool = pool.filter(e => !excluded.has(e.recordingMbid) && !excluded.has(songKey(e)));
  }
  if (refresh && settings!.autoDownload) {
    snapshot!.pending = entries;
    snapshot!.pendingRejected = [];
    commit();
    return;
  }
  transaction(() => {
    if (refresh) {
      for (const entry of snapshot!.entries) { exclude(entry, 'expired'); if (entry.jobId) snapshot!.retired.push(entry.jobId); }
      snapshot!.refreshedAt = Date.now();
    }
    snapshot!.entries = entries;
    if (!snapshot!.refreshedAt && entries.length) snapshot!.refreshedAt = Date.now();
  });
}
async function queue(entry: Entry, background = false, automatic = false) {
  if (!downloads) throw new Error('Install the updated APK to download Discover songs.');
  if (entry.track) return;
  const jobs = await downloads.getJobsAsync(false);
  const active = jobs.find(j => j.id === entry.jobId && isActive(j));
  if (active) { if (!automatic) await downloads.prioritizeDiscoverAsync(active.id); return; }
  emit({ message: `Finding audio: ${entry.title}…` });
  const videos = await downloads.searchAsync(`${entry.artist} ${entry.title} official audio`, `discover-${entry.recordingMbid}`);
  const video = chooseVideo(entry, videos);
  if (!video) throw new Error(NO_MATCH);
  const source = { ...video, discoveryTitle: entry.title, discoveryArtist: entry.artist, discoverAutomatic: automatic, discoverWifiOnly: automatic && settings!.wifiOnly };
  if (entry.jobId) snapshot!.retired.push(entry.jobId);
  entry.jobId = background ? await downloads.queueDiscoverBackgroundAsync(source, entry.recordingMbid)
    : await downloads.enqueueDiscoverAsync(source, entry.recordingMbid);
  entry.error = undefined; commit();
}
async function autoDownload(background: boolean) {
  if (!settings!.autoDownload || !downloads) { emit({ waiting: '' }); return; }
  const network = await downloads.discoverNetworkAsync();
  if (!network.connected || (settings!.wifiOnly && !network.wifi)) { emit({ waiting: settings!.wifiOnly ? 'Waiting for unmetered Wi-Fi' : 'Waiting for a connection' }); return; }
  emit({ waiting: '' });
  let processed = 0;
  for (const entry of snapshot!.pending ?? snapshot!.entries) {
    if (entry.track || (entry.error && !entry.error.includes('Waiting for Wi-Fi'))) continue;
    try {
      const alreadyQueued = view.jobs.some(j => j.id === entry.jobId && isActive(j));
      await queue(entry, background, true);
      if (!background && !alreadyQueued && ++processed >= 3) break;
      if (background && entry.jobId) {
        await downloads.downloadDiscoverBackgroundAsync(entry.jobId);
        await sync();
        // Keep each OS work window bounded. Subsequent windows continue the batch.
        if (++processed >= 2) break;
      }
    } catch (e) { entry.error = discoverError(e); commit(); }
  }
}
/**
 * A song with no studio recording to be found gives up its place.
 *
 * It used to keep it and ask to be tapped again later, which is a row of the
 * list that plays nothing and, a week on, still plays nothing. It is put away
 * for a month instead and the best song not yet shown takes the place, from
 * the pool already fetched. If the pool has run dry the list is left short,
 * and being short is what makes the next pass fetch a new one.
 */
function replaceUnmatched(): boolean {
  const gone = snapshot!.entries.filter(e => !e.track && isNoMatch(e.error));
  if (!gone.length) return false;
  transaction(() => {
    for (const entry of gone) { exclude(entry, 'unmatched'); if (entry.jobId) snapshot!.retired.push(entry.jobId); }
    const excluded = exclusions();
    for (const entry of snapshot!.pending ?? []) { excluded.add(entry.recordingMbid); excluded.add(songKey(entry)); }
    snapshot!.entries = selectSongs(snapshot!.pool, snapshot!.entries.filter(e => !gone.includes(e)), settings!.count, excluded);
  });
  if (snapshot!.entries.length < settings!.count) lastAttempt = 0;
  return true;
}
function discardPending() {
  for (const entry of snapshot!.pending ?? []) if (entry.jobId) snapshot!.retired.push(entry.jobId);
  snapshot!.pending = undefined; snapshot!.pendingRejected = undefined;
}
function finishPending() {
  const pending = snapshot!.pending;
  if (!pending) return;
  // A bad source gets another candidate, without destroying the old playable batch.
  const failed = pending.filter(e => e.error && !e.error.includes('Waiting for Wi-Fi'));
  if (failed.length) {
    snapshot!.pendingRejected = [...(snapshot!.pendingRejected ?? []), ...failed.map(e => e.recordingMbid)];
    failed.forEach(e => { if (isNoMatch(e.error)) exclude(e, 'unmatched'); if (e.jobId) snapshot!.retired.push(e.jobId); });
    const excluded = new Set([...exclusions(), ...(snapshot!.pendingRejected ?? []), ...snapshot!.entries.flatMap(e => [e.recordingMbid, songKey(e)])]);
    snapshot!.pending = selectSongs(snapshot!.pool, pending.filter(e => !failed.includes(e)), settings!.count, excluded);
    commit();
  }
  if (batchReady(snapshot!.pending, settings!.count)) {
    transaction(() => {
      snapshot!.entries.forEach(e => { exclude(e, 'expired'); if (e.jobId) snapshot!.retired.push(e.jobId); });
      snapshot!.entries = snapshot!.pending!;
      snapshot!.pending = undefined; snapshot!.pendingRejected = undefined;
      snapshot!.refreshedAt = Date.now();
    });
  }
}
export function maintainDiscover(force = false, background = false): Promise<void> {
  if (maintenance) return maintenance;
  maintenance = exclusive(async () => {
    emit({ busy: true, error: '', message: 'Checking Discover…' });
    try {
      await sync();
      const due = settings!.refreshDays > 0 && Date.now() - snapshot!.refreshedAt >= settings!.refreshDays * DAY;
      const missing = snapshot!.entries.length < settings!.count;
      if (force && snapshot!.pending) {
        snapshot!.pending.forEach(e => { e.error = undefined; });
        if (snapshot!.pending.length < settings!.count) discardPending();
      }
      if (!snapshot!.pending && (force || ((due || missing) && Date.now() - lastAttempt > 15 * 60_000))) {
        lastAttempt = Date.now(); await fill(force || (due && snapshot!.entries.length > 0));
      }
      await autoDownload(background);
      // A replacement can be as unfindable as what it replaced, so it is tried
      // too, a few times over and no more: each round is a search per song.
      for (let round = 0; round < 3 && replaceUnmatched(); round++) await autoDownload(background);
      await sync(); finishPending();
    } catch (e) { emit({ error: discoverError(e) }); }
    finally { emit({ busy: false, message: '' }); }
  }).finally(() => { maintenance = null; });
  return maintenance;
}
export function refreshDiscoverReceipts() { return exclusive(async () => { await sync(); finishPending(); }); }
export function configureDiscover(value: DiscoverSettings) {
  return exclusive(async () => {
    discardPending();
    settings = value; saveDiscoverSettings(value);
    if (downloads) {
      const jobs = await downloads.getJobsAsync(false);
      for (const job of jobs) {
        if (job.discoverKey && (job.video as typeof job.video & { discoverAutomatic?: boolean }).discoverAutomatic && isActive(job)) {
          await downloads.cancelAsync(job.id);
          snapshot!.retired.push(job.id);
          const entry = snapshot!.entries.find(e => e.jobId === job.id);
          if (entry) { entry.jobId = undefined; entry.error = undefined; }
        }
      }
      for (const entry of snapshot!.entries) if (!entry.track) entry.error = undefined;
    }
    if (snapshot!.entries.length > value.count) {
      const dropped = snapshot!.entries.splice(value.count);
      dropped.forEach(e => { if (e.jobId) snapshot!.retired.push(e.jobId); });
    }
    lastAttempt = 0; commit();
  }).then(() => maintainDiscover());
}
export function retryDiscoverFill() { lastAttempt = 0; return maintainDiscover(); }
export function rejectDiscover(id: string) {
  return exclusive(async () => {
    const entry = snapshot!.entries.find(e => e.recordingMbid === id);
    if (!entry) return;
    discardPending();
    undoEntries.clear(); undoEntries.set(id, { ...entry });
    transaction(() => {
      exclude(entry, 'blocked');
      snapshot!.entries = snapshot!.entries.filter(e => e !== entry);
      if (entry.jobId) snapshot!.retired.push(entry.jobId);
    });
    lastAttempt = 0;
  }).then(() => maintainDiscover());
}
export function undoDiscover(id: string, restore = false) {
  return exclusive(async () => {
    unblock(id);
    const entry = restore ? undoEntries.get(id) : undefined;
    if (entry) {
      const index = snapshot!.entries.findLastIndex(e => e.familiar === entry.familiar);
      if (snapshot!.entries.length >= settings!.count && index >= 0) {
        const [replaced] = snapshot!.entries.splice(index, 1);
        if (replaced.jobId) snapshot!.retired.push(replaced.jobId);
      }
      snapshot!.entries.push({ ...entry, track: undefined, error: undefined });
      snapshot!.retired = snapshot!.retired.filter(id => id !== entry.jobId);
      undoEntries.delete(id);
    }
    commit();
  }).then(() => maintainDiscover());
}
export async function prepareDiscover(id: string, abandoned: () => boolean = () => false): Promise<Track> {
  await exclusive(async () => {
    if (abandoned()) throw new Error("Playback request cancelled.");
    await sync();
    const entry = snapshot!.entries.find(e => e.recordingMbid === id);
    if (!entry) throw new Error('This recommendation has changed. Choose another song.');
    entry.error = undefined;
    try { await queue(entry); }
    catch (e) { entry.error = discoverError(e); commit(); throw e; }
    commit();
  }).catch(e => {
    // Tapped and not to be found: the next pass takes it out and fills the place.
    if (isNoMatch(discoverError(e))) void maintainDiscover();
    throw e;
  });
  // No lock while waiting; minus, settings and other downloads stay usable.
  const deadline = Date.now() + 35 * 60_000;
  while (Date.now() < deadline) {
    if (abandoned()) throw new Error("Playback request cancelled.");
    await refreshDiscoverReceipts();
    const entry = snapshot!.entries.find(e => e.recordingMbid === id);
    if (!entry) throw new Error('This song is no longer in Discover.');
    if (entry.track) return entry.track;
    if (entry.error) throw new Error(entry.error);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('The download is taking too long. Please retry.');
}
export async function keepDiscover(id: string): Promise<void> {
  await prepareDiscover(id);
  await exclusive(async () => {
    const entry = snapshot!.entries.find(e => e.recordingMbid === id);
    if (!entry?.jobId || !downloads) throw new Error('The song is no longer available.');
    discardPending();
    const trackId = await downloads.keepDiscoverAsync(entry.jobId, libraryRoot());
    if (entry.tags?.length) saveLookupTags(trackId, entry.tags, 'musicbrainz');
    transaction(() => {
      exclude(entry, 'saved');
      snapshot!.entries = snapshot!.entries.filter(e => e !== entry);
      snapshot!.retired.push(entry.jobId!);
    });
    lastAttempt = 0;
  });
  await maintainDiscover();
}
