import { useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Says a line aloud to whoever is listening through a screen reader, and to
 * nobody else.
 *
 * For what changes on a screen without the reader's focus going anywhere near
 * it: a note that a file was saved, a download that finished in the
 * background. Android has live regions for this, and they are used where a
 * line of text stays on screen and only its words change; but a note that
 * appears where there was nothing is a view that has only just been made, and
 * whether a live region on such a view is spoken at all differs from one
 * version of TalkBack to the next. Asking out loud is spoken every time.
 */
export function announce(message: string | null | undefined): void {
  if (message) AccessibilityInfo.announceForAccessibility(message);
}

/**
 * The same, for a message held in state: said each time it changes to
 * something, and not again while it stays the same.
 */
export function useAnnounce(message: string | null | undefined): void {
  useEffect(() => {
    announce(message);
  }, [message]);
}
