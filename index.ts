// The tasks run with the app closed, defined before anything else: a task the phone wakes the app for with no screen
// is looked for at once, and one not defined by then is taken away. The screens are not read in such a run.
import './src/lib/discover/background';
import './src/lib/podcasts/background';
import './src/lib/backup/background';
import 'expo-router/entry';
