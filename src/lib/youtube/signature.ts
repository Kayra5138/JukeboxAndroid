import type { DownloadJob } from './types.ts';

/**
 * Whether two readings of the queue are the same to look at.
 *
 * The jobs are read again and again while anything is going on, and most
 * readings find what the last one found. Handing the screens a new list each
 * time all the same would draw every one of them again for nothing, so a
 * reading is first put into a word, and the list is only replaced when the
 * word is a different one.
 *
 * In the word is everything a screen shows or decides by: which jobs, in
 * what order, how far each has got, how it ended, what it is called, and the
 * record it is for. Not in it is anything the phone never changes once a job
 * is made.
 */
export function jobsSignature(jobs: readonly DownloadJob[], paused: boolean): string {
  const parts: unknown[] = [paused];
  for (const job of jobs) {
    const video = job.video;
    parts.push([
      job.id, job.status, job.progress, job.trackId, job.errorCode ?? null, job.errorText ?? job.error,
      job.described, job.cleared ?? null, job.automatic ?? null, job.startedAt ?? null, job.finishedAt ?? null,
      video.id, video.title, video.channel, video.thumbnail, video.find != null, video.placement ?? null,
    ]);
  }
  return JSON.stringify(parts);
}

/**
 * The downloads that have arrived, as a word: which, and as which track.
 * What a playlist made from YouTube is brought up to date by, and so the
 * only thing that needs it looked at again.
 */
export function arrivedSignature(jobs: readonly DownloadJob[]): string {
  const parts: string[] = [];
  for (const job of jobs) if (job.status === 'done') parts.push(`${job.id}:${job.trackId ?? ''}`);
  return parts.join('|');
}

/**
 * What a finished job is remembered by once it has been filed under its
 * record: itself and the place it carries.
 *
 * Not the job alone. A video that was already here when a track of an album
 * was asked for by name is not fetched again; the job it has is handed the
 * place instead, after it was first seen without one. Remembered by its id
 * it would look done with, and the track would never be filed.
 */
export function filingKey(job: DownloadJob): string {
  return `${job.id}|${JSON.stringify(job.video.placement ?? null)}`;
}
