import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { loadLanguage } from '../i18n/index';
import { maintainDiscoverInBackground } from './engine';
import { readDiscoverSettings } from './store';

const TASK = 'jukebox-discover';

TaskManager.defineTask(TASK, async () => {
  // Run with no screen, so nothing else has read the language yet. Nothing made here is kept as words any more, but the
  // download's notification and the catalogue's progress are said in it.
  loadLanguage();
  const well = await maintainDiscoverInBackground();
  return well ? BackgroundTask.BackgroundTaskResult.Success : BackgroundTask.BackgroundTaskResult.Failed;
});

/**
 * Has the task run now and then, where there is anything for it to do: a
 * refresh that falls due by itself, or songs to keep ready. With neither,
 * Discover does nothing nobody asked for, and the task is taken away.
 */
export async function scheduleDiscover() {
  const settings = readDiscoverSettings();
  if (!settings.refreshDays && !settings.ready) {
    if (await TaskManager.isTaskRegisteredAsync(TASK)) await BackgroundTask.unregisterTaskAsync(TASK);
  } else {
    // Frequent small opportunities let downloads continue without one enormous OS work window.
    await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 60 });
  }
}
