import { createContext, use, useEffect, useId, useState, useSyncExternalStore, type ReactNode } from 'react';

import { useBack } from '../lib/ui/back';
import { createStore, type Store } from '../lib/ui/store';

/**
 * The pages opened inside a card that is a place of its own (`TabbedCard`):
 * the player's settings, whose every page and question stays in the card,
 * where everything else in the app opens a page in the tab (`OnAPage`).
 * Newest last; the card shows that one, its name over it and a way back.
 */
export type CardPage = { key: string; title: string; body: ReactNode; bare: boolean; onClose: () => void };

/** Round what is in such a card, by the card: its pages. */
export const CardPagesOf = createContext<Store<readonly CardPage[]> | null>(null);

/** Whether what is drawn here is in such a card, where a page opens in the card. */
export function useInCard(): boolean {
  return use(CardPagesOf) != null;
}

/** For the card: a place for its pages, and those open now. */
export function useCardPages(): { pages: Store<readonly CardPage[]>; open: readonly CardPage[] } {
  const [pages] = useState(() => createStore<readonly CardPage[]>([]));
  const open = useSyncExternalStore(pages.subscribe, pages.get);
  return { pages, open };
}

/**
 * A page in the card, while [visible]: [title] over it, and [children]
 * scrolling under that, or scrolling themselves for [bare]. Back closes it,
 * as the card's way back does, as [onClose]. Drawn by the card rather than
 * here, so that it is over what opened it and in the card's own room.
 */
export function PageInCard({
  visible,
  title,
  onClose,
  bare = false,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  bare?: boolean;
  children: ReactNode;
}) {
  const pages = use(CardPagesOf);
  const key = useId();
  useBack(visible, onClose);
  // As it is now, every time it is drawn, for the card to draw it the same; in the order they were opened.
  useEffect(() => {
    if (!pages) return;
    const now = pages.get();
    const at = now.findIndex((page) => page.key === key);
    if (!visible) {
      if (at >= 0) pages.set(now.filter((page) => page.key !== key));
      return;
    }
    const page = { key, title, body: children, bare, onClose };
    pages.set(at >= 0 ? now.map((one) => (one.key === key ? page : one)) : [...now, page]);
  });
  // Taken out as it goes, whatever it was.
  useEffect(
    () => () => {
      if (pages && pages.get().some((page) => page.key === key)) pages.set(pages.get().filter((page) => page.key !== key));
    },
    [key, pages]
  );
  return null;
}
