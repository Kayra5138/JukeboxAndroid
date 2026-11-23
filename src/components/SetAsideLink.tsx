import type { HeadLink } from './MediaPage';
import { useT } from '../lib/i18n/index';
import { setAside, useSetAside } from '../lib/library/setAside';
import { haptic } from '../lib/ui/haptics';

/**
 * Among the links under a record's, an artist's, a list's or a folder's buttons (`MediaHead`): setting the whole
 * of it aside, or bringing it back, whichever it is now (`library/setAside.ts`). Null where [kind] is: asked for
 * on every page, whatever the page turns out to be, as a hook has to be.
 */
export function useSetAsideLink(kind: 'album' | 'artist' | 'list' | 'folder' | null, itemKey: string | null): HeadLink | null {
  const t = useT();
  const all = useSetAside();
  if (kind == null || itemKey == null) return null;
  const aside = all[kind].has(itemKey);
  const words = t.library.setAside[kind];
  return {
    label: aside ? words.back : words.set,
    onPress: () => {
      haptic('results', aside ? 'toggleOff' : 'confirm');
      setAside(kind, itemKey, !aside);
    },
  };
}
