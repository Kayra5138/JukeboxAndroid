import { Linking } from 'react-native';

import { noteError } from '../support/errorLogStore';
import { haptic } from './haptics';

/**
 * [url] opened in whatever the phone opens it with. Where nothing will, a
 * buzz that says the press did nothing, and a line in the report: let go of
 * without a word, a press of a link on a phone with no browser looked like
 * a button that was broken.
 */
export function openLink(url: string): void {
  void Linking.openURL(url).catch((error: unknown) => {
    haptic('results', 'reject');
    noteError('js', error, 'A link could not be opened');
  });
}
