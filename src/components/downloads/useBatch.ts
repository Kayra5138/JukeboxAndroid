import { useEffect, useState } from 'react';

import { useDownloads } from '../../lib/youtube/DownloadsProvider';
import { batchOf, RUN_LINGER_MS, type Batch } from '../../lib/youtube/queueView';

/**
 * The recent downloads, kept up to date: see `batchOf` for what they are.
 *
 * What they are depends on the time as well as on the jobs, and the time is
 * not something a draw may go and look at whenever it likes. It is noted
 * when the jobs are read anew, which is each second while anything is being
 * fetched, and kept beside them.
 *
 * That leaves the one moment nothing would otherwise mark. Once everything
 * has finished the jobs are not read again, so nothing would ever say that
 * a finished run had stopped being recent: a run that has ended sets a timer
 * for when it is no longer to be spoken of, and the time is noted then.
 */
export function useBatch(): Batch {
  const { all } = useDownloads();
  const [seen, setSeen] = useState(() => ({ all, at: Date.now() }));
  let now = seen.at;
  if (seen.all !== all) {
    now = Date.now();
    setSeen({ all, at: now });
  }
  const batch = batchOf(all, now);
  const endedAt = batch.endedAt;
  useEffect(() => {
    if (endedAt == null) return;
    const wait = Math.max(0, endedAt + RUN_LINGER_MS - Date.now()) + 50;
    const timer = setTimeout(() => setSeen((held) => ({ all: held.all, at: Date.now() })), wait);
    return () => clearTimeout(timer);
  }, [endedAt]);
  return batch;
}
