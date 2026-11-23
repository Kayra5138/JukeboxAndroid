import { Fragment } from 'react';
import { View } from 'react-native';

import { Pressable } from '../Pressable';
import { Text } from './Find';
import { useRows, Chevron } from './rows';
import { useT } from '../../lib/i18n/index';
import type { SettingsHit } from '../../lib/settings/search';
import { usePressed } from '../../lib/theme/index';

/**
 * What Settings' search found, in place of its categories while anything is
 * typed: each word as it is shown, and under it where it is, by the names of
 * the pages on the way (`lib/settings/search.ts`).
 */
export function SearchResults({ hits, query, onOpen }: { hits: readonly SettingsHit[]; query: string; onOpen: (hit: SettingsHit) => void }) {
  const t = useT();
  const rows = useRows();
  const pressed = usePressed();
  if (hits.length === 0) return <Text style={rows.aside}>{t.settings.search.none(query)}</Text>;
  return (
    <View style={rows.card}>
      {hits.map((hit, index) => (
        <Fragment key={`${hit.page}\u0000${hit.text}`}>
          {index > 0 ? <View style={rows.rule} /> : null}
          <Pressable android_ripple={pressed} accessibilityRole="button" style={rows.row} onPress={() => onOpen(hit)}>
            <View style={rows.line}>
              <Text style={rows.title} numberOfLines={2}>
                {hit.text}
              </Text>
              <Chevron />
            </View>
            {/* Where it is: the pages on the way, the page itself too unless it is what was found. */}
            <Text style={rows.muted} numberOfLines={1}>
              {(hit.isPage ? hit.trail.slice(0, -1) : hit.trail).join(' › ')}
            </Text>
          </Pressable>
        </Fragment>
      ))}
    </View>
  );
}
