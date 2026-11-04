import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { autoBackup, backUpIfDue } from './auto';

const TASK = 'jukebox-backup';

TaskManager.defineTask(TASK, async () => {
  // Never throws; a backup not made is written down for Your data, and tried again next time.
  const made = await backUpIfDue();
  return made === false ? BackgroundTask.BackgroundTaskResult.Failed : BackgroundTask.BackgroundTaskResult.Success;
});

/*
  How often the phone is asked to wake the app for it. Far more often than a
  backup falls due, since the phone takes this as the least time between runs
  and not a promise of one: each run that finds none due reads a few settings
  and stops.
*/
const EVERY_MINUTES = 6 * 60;

/**
 * Has automatic backup looked at with the app closed as well as open, while
 * it is on and has a folder. Off, nothing is asked of the phone, and the task
 * is taken away.
 */
export async function scheduleBackups(): Promise<void> {
  try {
    const { on, folder } = autoBackup();
    if (!on || !folder) {
      if (await TaskManager.isTaskRegisteredAsync(TASK)) await BackgroundTask.unregisterTaskAsync(TASK);
    } else {
      await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: EVERY_MINUTES });
    }
  } catch (error) {
    console.warn('Could not schedule automatic backups', error);
  }
}
