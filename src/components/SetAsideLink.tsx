import { Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { Pressable } from './Pressable';
import { useT } from '../lib/i18n/index';
import { setAside, useSetAside } from '../lib/library/setAside';
import { haptic } from '../lib/ui/haptics';

/**
 * Among the quiet links under a record's, an artist's, a list's or a folder's buttons:
 * setting the whole of it aside, or bringing it back, whichever it is now
 * (`library/setAside.ts`). Drawn as the links beside it are, by [hit] and
 * [style].
 */
export function SetAsideLink({
  kind,
  itemKey,
  hit,
  style,
}: {
  kind: 'album' | 'artist' | 'list' | 'folder';
  itemKey: string;
  hit: StyleProp<ViewStyle>;
  style: StyleProp<TextStyle>;
}) {
  const t = useT();
  const aside = useSetAside()[kind].has(itemKey);
  const words = t.library.setAside[kind];
  return (
    <Pressable
      style={hit}
      accessibilityRole="button"
      onPress={() => {
        haptic('results', aside ? 'toggleOff' : 'confirm');
        setAside(kind, itemKey, !aside);
      }}>
      <Text style={style}>{aside ? words.back : words.set}</Text>
    </Pressable>
  );
}
