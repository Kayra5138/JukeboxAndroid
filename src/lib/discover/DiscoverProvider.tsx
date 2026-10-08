import { createContext, use, useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { usePlayerActions, usePlayerState } from '../player/PlayerProvider';
import { ensureNotificationPermission } from '../media/library';
import { scheduleDiscover } from './background';
import { discoverView, subscribeDiscover, maintainDiscover, prepareDiscover, protectDiscoverQueue, refreshDiscoverReceipts } from './engine';
import type { Track } from '../types';
const Context = createContext<{ play: (id: string) => Promise<void>; stopPreparing: () => void } | null>(null);
export function useDiscover() { return useSyncExternalStore(subscribeDiscover, discoverView); }
export function useDiscoverPlayback() { return use(Context)!; }
export function DiscoverProvider({ children }: { children: ReactNode }) {
  const player = usePlayerState();
  const actions = usePlayerActions();
  const queue = useRef<Track[]>(player.queue);
  queue.current = player.queue;
  const token = useRef(0);
  useEffect(() => { protectDiscoverQueue(player.queue); }, [player.queue]);
  useEffect(() => {
    void maintainDiscover();
    void scheduleDiscover().catch(console.warn);
    const foreground = () => { if (AppState.currentState === 'active') void maintainDiscover(); };
    const subscription = AppState.addEventListener('change', foreground);
    let nextAutomatic = 0;
    const timer = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      const view = discoverView();
      if (!view.busy && Date.now() >= nextAutomatic && view.settings.autoDownload && (view.snapshot?.pending ?? view.snapshot?.entries)?.some(e => !e.track && !e.jobId && !e.error)) {
        nextAutomatic = Date.now() + 10_000;
        void maintainDiscover();
      } else if (!view.busy && view.jobs.some(j => ['queued','finding','preparing','downloading','converting','saving','cancelling'].includes(j.status))) void refreshDiscoverReceipts().catch(console.warn);
    }, 1500);
    const check = setInterval(foreground, 60_000);
    return () => { subscription.remove(); clearInterval(timer); clearInterval(check); token.current++; };
  }, []);
  const play = async (id: string) => {
    const request = ++token.current;
    await ensureNotificationPermission();
    const entries = discoverView().snapshot?.entries ?? [];
    const index = entries.findIndex(e => e.recordingMbid === id);
    if (index < 0) return;
    const before = queue.current;
    const track = await prepareDiscover(id, () => request !== token.current || queue.current !== before);
    if (request !== token.current) return;
    if (queue.current !== before) return;
    const following = [...entries.slice(index + 1), ...entries.slice(0, index)];
    const initial = [track];
    while (following[0]?.track) initial.push(following.shift()!.track!);
    await actions.playQueue(initial, 0);
    queue.current = initial;
    // Download-on-tap starts immediately; following songs join the same queue as they arrive.
    void (async () => {
      for (const entry of following) {
        if (request !== token.current) break;
        try {
          const next = await prepareDiscover(entry.recordingMbid, () => request !== token.current || queue.current[0]?.id !== track.id);
          if (request !== token.current || queue.current[0]?.id !== track.id) break;
          await actions.addToQueue(next);
        } catch { /* A failed recording is shown in Discover; keep the rest playable. */ }
      }
    })();
  };
  return <Context value={{ play, stopPreparing: () => { token.current++; } }}>{children}</Context>;
}
