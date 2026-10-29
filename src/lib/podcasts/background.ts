import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { loadLanguage } from '../i18n/index';
import { cleanUpPlayed, deletePlayedDays } from './cleanup';
import { checkPodcasts } from './refresh';
import { subscriptions } from './store';

const TASK = 'jukebox-podcasts';

TaskManager.defineTask(TASK, async () => {
  try {
    // Run with no screen, so nothing has read the language yet; the downloads' notification is said in it.
    loadLanguage();
    await checkPodcasts();
    await cleanUpPlayed();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/**
 * Has the followed podcasts looked at now and then with the app closed as
 * well as open — their feeds read again when six hours old, their new
 * episodes fetched, and those heard long enough ago deleted — wherever there
 * is a show that fetches by itself or a number of days to delete after. With
 * neither, nothing is asked of the phone, and the task is taken away.
 */
export async function schedulePodcasts(): Promise<void> {
  try {
    const wanted = subscriptions().some((show) => show.autoDownload) || deletePlayedDays() != null;
    if (!wanted) {
      if (await TaskManager.isTaskRegisteredAsync(TASK)) await BackgroundTask.unregisterTaskAsync(TASK);
    } else {
      await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 60 });
    }
  } catch (error) {
    console.warn('Could not schedule the podcasts', error);
  }
}
