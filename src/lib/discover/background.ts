import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { loadLanguage } from '../i18n/index';
import { maintainDiscover, discoverView } from './engine';
import { readDiscoverSettings } from './store';
const TASK = 'jukebox-discover';
TaskManager.defineTask(TASK, async () => {
  // Run with no screen, so nothing else has read the language yet, and what is
  // made here is kept: an error stored with a song is read later, on a screen.
  loadLanguage();
  await maintainDiscover(false, true);
  return discoverView().error ? BackgroundTask.BackgroundTaskResult.Failed : BackgroundTask.BackgroundTaskResult.Success;
});
export async function scheduleDiscover() {
  const settings = readDiscoverSettings();
  if (!settings.refreshDays && !settings.autoDownload) {
    if (await TaskManager.isTaskRegisteredAsync(TASK)) await BackgroundTask.unregisterTaskAsync(TASK);
  } else {
    // Frequent small opportunities let downloads continue without one enormous OS work window.
    await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 60 });
  }
}
