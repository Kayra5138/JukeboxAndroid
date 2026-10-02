import { jobForVideo, type DownloadJob } from './types.ts';

export type ImportedItem = { videoId: string; trackId?: string };

/** Late completions go before already imported later songs, without duplicating
 * receipts or undoing a user's removal of a previously imported track. */
export function reconcilePlaylist(items: ImportedItem[], current: string[], jobs: DownloadJob[]) {
  const order = [...current];
  const receipts = items.map((item) => ({ ...item }));
  let changed = false;
  for (const [index, item] of receipts.entries()) {
    const job = jobForVideo(jobs, item.videoId);
    if (job?.status !== 'done' || !job.trackId || item.trackId === job.trackId) continue;
    if (!order.includes(job.trackId)) {
      const following = receipts.slice(index + 1).find((next) => next.trackId && order.includes(next.trackId));
      const at = following?.trackId ? order.indexOf(following.trackId) : order.length;
      order.splice(at, 0, job.trackId);
    }
    item.trackId = job.trackId;
    changed = true;
  }
  return { order, receipts, changed };
}
