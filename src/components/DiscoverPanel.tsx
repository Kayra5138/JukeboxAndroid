import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';

import { DiscoverAbout } from './discover/DiscoverAbout';
import { DiscoverHeader, discoverHeaderHeight } from './discover/DiscoverHeader';
import { DiscoverMenu } from './discover/DiscoverMenu';
import { DiscoverNotice } from './discover/DiscoverNotice';
import { DiscoverRow, useDiscoverRowHeight } from './discover/DiscoverRow';
import { useDiscoverIds } from './discover/hooks';
import { ListEmpty, ListFoot } from './discover/ListEdges';
import { makeStyles } from '../lib/theme/index';
import { useTip } from '../lib/ui/tipsStore';
import { useListColumns } from '../lib/ui/layout';
import { DiscoverTip } from './welcome/DiscoverTip';
import { useUnderBars } from './UnderBars';
import { CLIP_SUBVIEWS } from '../lib/ui/lists';

const keyOf = (id: string) => id;

/**
 * The Discover list.
 *
 * One list of rows the height of the Library's, under a short header, with
 * what was last done said at the foot. The parts are each their own
 * component and each listen for the one thing they show: the header for
 * the list's state, a row for its own song, the snackbar for the notice.
 * This holds only which songs there are and in what order, so it is drawn
 * again when a song comes or goes and not while one is being fetched.
 *
 * The two sheets — a song's menu, and what Discover is — are opened from
 * the rows and the header and kept here, above both.
 */
export function DiscoverPanel() {
  const ids = useDiscoverIds();
  const columns = useListColumns();
  const { width, fontScale } = useWindowDimensions();
  const router = useRouter();
  const styles = useStyles();
  const [menu, setMenu] = useState<string | null>(null);
  const [about, setAbout] = useState(false);

  // The same functions every time, because rows are remembered and are handed these as they are.
  const openMenu = useCallback((id: string) => setMenu(id), []);
  const closeMenu = useCallback(() => setMenu(null), []);
  const openAbout = useCallback(() => setAbout(true), []);
  const closeAbout = useCallback(() => setAbout(false), []);
  const openSettings = useCallback(() => router.push('/discover-settings'), [router]);

  const shared = columns > 1;
  const renderItem = useCallback(
    ({ item }: { item: string }) => <DiscoverRow id={item} shared={shared} onMenu={openMenu} />,
    [openMenu, shared]
  );
  const rowHeight = useDiscoverRowHeight();
  /*
    In a theme of glass the switches of the Search tab are over the top of
    this and the bars at the foot over the foot of it, and the list runs on
    under both. The tip, when there is one, keeps clear of the top itself
    and the list then begins under it, as it always has.
  */
  const under = useUnderBars({ player: true });
  const tipped = useTip('discover').shown;
  const top = tipped ? 0 : under.top;
  const headerHeight = top + discoverHeaderHeight(width, fontScale);

  return (
    <View style={styles.panel}>
      <DiscoverTip />
      <FlatList
              removeClippedSubviews={CLIP_SUBVIEWS}
        data={ids}
        // Remounted when the count changes: a list will not take a new
        // numColumns in place, and turning the phone is when it changes.
        key={columns}
        numColumns={columns}
        columnWrapperStyle={shared ? styles.columns : undefined}
        keyExtractor={keyOf}
        renderItem={renderItem}
        contentContainerStyle={[styles.content, { paddingTop: top, paddingBottom: 76 + under.bottom }]}
        /*
          Exact with one column, where every row is one further down than
          the last, and left to be measured with two: see the Library's list,
          which found out why the hard way.
        */
        getItemLayout={
          shared
            ? undefined
            : (_data, index) => ({
                length: rowHeight,
                offset: headerHeight + rowHeight * index,
                index,
              })
        }
        initialNumToRender={10 * columns}
        windowSize={7}
        ListHeaderComponent={<DiscoverHeader onAbout={openAbout} onSettings={openSettings} />}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={ListFoot}
      />
      <DiscoverNotice />
      <DiscoverMenu id={menu} onClose={closeMenu} />
      <DiscoverAbout visible={about} onClose={closeAbout} />
    </View>
  );
}

const useStyles = makeStyles(() => StyleSheet.create({
  panel: { flex: 1 },
  // Room under the last row for what floats at the foot: the notice, and the downloads button.
  content: { paddingBottom: 76 },
  columns: { gap: 8 },
}));
