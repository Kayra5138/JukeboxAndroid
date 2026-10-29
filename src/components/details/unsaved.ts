import { useIsFocused, useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { useT } from '../../lib/i18n/index';
import { useBack } from '../../lib/ui/back';

/**
 * Back on a tab of the details with something typed and not saved: asked
 * about, rather than lost without a word or kept without one. Keep editing
 * stays; Discard drops what was typed and goes back as the press meant to.
 */
export function useUnsavedBack(unsaved: boolean, discard: () => void): void {
  const t = useT();
  const router = useRouter();
  const focused = useIsFocused();
  const said = t.details.unsaved;
  useBack(unsaved && focused, () =>
    Alert.alert(said.title, said.body, [
      { text: said.keep, style: 'cancel' },
      {
        text: said.discard,
        style: 'destructive',
        onPress: () => {
          discard();
          if (router.canGoBack()) router.back();
        },
      },
    ])
  );
}
