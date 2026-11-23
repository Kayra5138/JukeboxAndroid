import { useIsFocused, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/build/react-navigation/core';
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';

import { ConfirmSheet } from '../ConfirmSheet';

import { useT } from '../../lib/i18n/index';
import { createStore } from '../../lib/ui/store';

/**
 * The tabs of the details with something typed and not saved, by name: told
 * only as one starts or stops having something, so that the screen is drawn
 * again for that and not each time a tab is.
 */
const unsaved = createStore<ReadonlySet<string>>(new Set());
/** How to let go of what each has, kept up to date as the tabs are drawn without telling anybody. */
const discards = new Map<string, () => void>();

/**
 * A tab of the details with something typed and not saved ([pending]), and
 * how to let go of it: told to the screen, which asks before it is left
 * (`useUnsavedGuard`).
 */
export function useUnsavedBack(pending: boolean, discard: () => void, tab: string): void {
  const latest = useRef(discard);
  useEffect(() => {
    latest.current = discard;
  });
  useEffect(() => {
    if (!pending) return;
    discards.set(tab, () => latest.current());
    unsaved.set(new Set([...unsaved.get(), tab]));
    return () => {
      discards.delete(tab);
      const after = new Set(unsaved.get());
      after.delete(tab);
      unsaved.set(after);
    };
  }, [pending, tab]);
}

/**
 * The details left with something typed and not saved on any of its tabs:
 * asked about, rather than lost without a word or kept without one. Keep
 * editing stays; Discard drops what was typed and goes as the press meant to.
 *
 * Whichever way it is left: Back, and the arrow in its bar too, which went
 * straight past the question when only Back asked it. Asked on the app's own
 * card (`ConfirmSheet`), which the screen draws: the element answered here.
 */
export function useUnsavedGuard(): ReactNode {
  const t = useT();
  const navigation = useNavigation();
  const focused = useIsFocused();
  const pending = useSyncExternalStore(unsaved.subscribe, unsaved.get);
  const said = t.details.unsaved;
  // The leaving that was stopped, to be let go on with if Discard is pressed.
  const [leaving, setLeaving] = useState<{ action: Parameters<typeof navigation.dispatch>[0] } | null>(null);
  usePreventRemove(focused && pending.size > 0, ({ data }) => setLeaving({ action: data.action }));
  return (
    <ConfirmSheet
      visible={leaving != null}
      title={said.title}
      body={said.body}
      cancelLabel={said.keep}
      confirmLabel={said.discard}
      danger
      onCancel={() => setLeaving(null)}
      onConfirm={() => {
        const going = leaving;
        for (const tab of unsaved.get()) discards.get(tab)?.();
        if (going) navigation.dispatch(going.action);
      }}
    />
  );
}
