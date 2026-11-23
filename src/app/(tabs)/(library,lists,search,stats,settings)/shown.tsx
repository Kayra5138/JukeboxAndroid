import { Stack, useIsFocused, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { CommonActions, usePreventRemove, useRoute } from 'expo-router/build/react-navigation/core';
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { View } from 'react-native';
import { scene, useColours } from '../../../lib/theme/index';

import { SettingsPage } from '../../../components/settings/rows';
import { notePage, pageClosed, pageOf, pageOpen, pagesVersion, subscribePages } from '../../../lib/ui/onAPage';

/**
 * What would have been a sheet over a page of Settings, as a page of its own
 * (`OnAPage`): kept in `lib/ui/onAPage.ts` under the token in the address by
 * whoever opened it, and drawn here as it stands.
 */
export default function ShownPage() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const router = useRouter();
  // Drawn again as whoever opened it changes what it shows.
  useSyncExternalStore(subscribePages, pagesVersion);
  const shown = pageOf(token);

  // Gone back from: whoever opened it is told, as a sheet told them on Cancel.
  useEffect(
    () => () => {
      if (!token || !pageOpen(token)) return;
      pageClosed(token);
      pageOf(token)?.onClose();
    },
    [token]
  );
  /*
    Whether it is in front, and how it is taken out from under another: a
    choice made on it can open a page over it (a record's rest, an artist),
    and closing it then by going back would close that page instead.
  */
  const navigation = useNavigation();
  const route = useRoute();
  const focused = useIsFocused();
  useEffect(() => {
    if (!token) return;
    notePage(token, focused, () =>
      navigation.dispatch((state) => {
        const routes = state.routes.filter((one) => one.key !== route.key);
        return CommonActions.reset({ ...state, routes, index: Math.max(0, routes.length - 1) } as never);
      })
    );
  }, [focused, navigation, route.key, token]);

  // Nothing to show, as when the app was opened afresh on this page: back to where it came from.
  // In front only: behind another, it is being taken out from under it, and going back would close that one.
  useEffect(() => {
    if (!shown && focused && router.canGoBack()) router.back();
  }, [focused, shown, router]);

  // Held where it is while something on it cannot be walked away from.
  usePreventRemove(shown?.locked === true, () => {});

  if (!shown) return null;
  if (shown.bare) {
    return (
      <Bare>
        <Stack.Screen options={{ title: shown.title }} />
        {shown.body}
      </Bare>
    );
  }
  return (
    <SettingsPage>
      <Stack.Screen options={{ title: shown.title }} />
      {shown.body}
    </SettingsPage>
  );
}

/** A page with nothing of its own but its colour, for what is shown on it to fill. */
function Bare({ children }: { children: ReactNode }) {
  const c = useColours();
  return <View style={{ flex: 1, ...scene(c) }}>{children}</View>;
}
