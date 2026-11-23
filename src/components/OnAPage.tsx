import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';

import { PageInCard, useInCard } from './CardPages';
import { closingOf, dropPage, offerPage, pageClosed, pageOpen, updatePage, type Shown } from '../lib/ui/onAPage';

/**
 * What would have been a sheet over the page, opened as a page of its own
 * in the tab instead (the `shown` page): for Settings, whose sheets were laid
 * over a page that was itself laid over another, the bar of what is playing
 * out of reach under them, with less room than a page has.
 *
 * Opened as [visible] comes and closed as it goes, as a sheet would be; gone
 * back from, [onClose] is called, as Cancel would have been. Draws nothing
 * here. [children] are handed to the page every time this is drawn: a field
 * among them keeps what is typed in it in itself, the page drawing the same
 * component in the same place each time.
 *
 * In a card that is a place of its own (`TabbedCard`), a page in that card
 * instead (`PageInCard`), so that nothing opened from it goes anywhere else.
 */
export function OnAPage(props: { visible: boolean; title: string; onClose: () => void; children: ReactNode; bare?: boolean; locked?: boolean }) {
  return useInCard() ? <PageInCard {...props} /> : <PageInTab {...props} />;
}

function PageInTab({ visible, title, onClose, children, bare, locked }: { visible: boolean; title: string; onClose: () => void; children: ReactNode; bare?: boolean; locked?: boolean }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const shown: Shown = { title, body: children, onClose, bare, locked };
  // As it stands, every time it is drawn, for the page to draw it the same.
  useEffect(() => {
    if (token != null) updatePage(token, shown);
  });
  useEffect(() => {
    if (visible && token == null) {
      const opened = offerPage(shown);
      setToken(opened);
      router.push({ pathname: '/shown', params: { token: opened } });
    } else if (!visible && token != null) {
      // Closed from here, as a choice made or a Cancel pressed closes it: the page goes too, unless it went first.
      const going = token;
      setToken(null);
      if (!pageOpen(going)) {
        dropPage(going);
        return;
      }
      pageClosed(going);
      /*
        A frame on, by when a choice that opened a page over it (a record's
        rest, an artist) has put it behind that one, as the page itself says:
        then it is taken out from under it, where going back would have
        closed the page just opened instead.
      */
      requestAnimationFrame(() => {
        const how = closingOf(going);
        if (how !== 'back') how();
        else if (router.canGoBack()) router.back();
        dropPage(going);
      });
    }
    // What is shown is handed over above at every drawing; only opening and closing are for here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, token]);
  // Gone with the page still open, as a page under it can be: nothing left to show on it.
  useEffect(
    () => () => {
      if (token != null) dropPage(token);
    },
    [token]
  );
  return null;
}
