import type { ReactNode } from 'react';

import { Dialog } from './Dialog';
import { useT } from '../lib/i18n/index';

/**
 * A question before something that cannot simply be taken back: the app's
 * own card over the screen, as its other questions are, and not Android's
 * dialog, which looked like another app's. Cancel, the back gesture and a
 * touch outside are the ways out; the other button is the thing itself.
 */
export function ConfirmSheet({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  danger = false,
  children,
}: {
  visible: boolean;
  title: string;
  body: string;
  /** Something more to settle before the yes, under what is asked: a switch for whether to delete as well. */
  children?: ReactNode;
  confirmLabel: string;
  /** The way out, where Cancel is not the word for it. */
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** What is asked for cannot be taken back -- deleting, cutting off -- and its button says so in red (`CardAnswers`). */
  danger?: boolean;
}) {
  const t = useT();
  return (
    <Dialog
      visible={visible}
      onClose={onCancel}
      title={title}
      body={body}
      answers={[
        { label: cancelLabel ?? t.common.cancel, kind: 'quiet', onPress: onCancel },
        {
          label: confirmLabel,
          kind: danger ? 'danger' : 'yes',
          // The thing itself first, then the card put away: whoever is told of the
          // one can then tell, in the other, that this was not a way out.
          onPress: () => {
            onConfirm();
            onCancel();
          },
        },
      ]}>
      {children}
    </Dialog>
  );
}
