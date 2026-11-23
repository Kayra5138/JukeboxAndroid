import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Busy } from '../Busy';
import { TextButton } from '../Button';
import { TickIcon } from '../Icons';
import { MediaRow, RowControl } from '../MediaRow';
import { Image } from '../Picture';
import { useT } from '../../lib/i18n/index';
import { makeStyles, useColours } from '../../lib/theme/index';
import { ICON, LEADING, RADIUS, ROW_COVER, SPACE, TYPE } from '../../lib/theme/measures';
import { durationLabel, isActive, type DownloadJob, type YouTubeResult } from '../../lib/youtube/types';
import { Chevron } from '../settings/rows';

/*
  The parts of a page of videos found: the Search tab's, which brings songs
  into the library, and adding a tape's, which brings talk into the tapes.
  Each was the other's copy, row for row.
*/

/**
 * Something to do with a video found, at the end of its row: hear it, fetch
 * it. A mark of its own ([icon]) while it can be done; while it is being
 * done, how far it has got (`busy`, [percent] where that is known), and once
 * it has, a tick (`done`). How it stands is said in full to a screen reader
 * ([accessibilityLabel]), with the video's name, since the marks are the
 * same on every row.
 */
export type VideoAction = {
  icon: (props: { size: number; color: string }) => ReactNode;
  accessibilityLabel: string;
  state?: 'busy' | 'done';
  percent?: number;
  disabled?: boolean;
  onPress: () => void;
};

/** How a download stands, as a video's action shows it: under way, and how far, or in. */
export function jobState(job: DownloadJob | undefined): Pick<VideoAction, 'state' | 'percent'> {
  if (!job) return {};
  if (isActive(job)) return { state: 'busy', percent: job.status === 'downloading' ? job.progress : undefined };
  return job.status === 'done' ? { state: 'done' } : {};
}

/**
 * A video or a list of them, found: a row of the app's (`MediaRow`), its
 * picture, its name, its channel and how long it is. A list is opened from
 * anywhere on its row, opening it only showing what is in it, so there is
 * nothing a stray tap can set off; a video's row is not, since what it does
 * is start a download, and has its [actions] at its end instead. [shared]
 * where it is one of two across.
 */
export function VideoRow({
  video,
  actions = [],
  onOpen,
  openDisabled = false,
  shared = false,
}: {
  video: YouTubeResult;
  actions?: VideoAction[];
  /** For a list: what opening it does. */
  onOpen?: () => void;
  openDisabled?: boolean;
  shared?: boolean;
}) {
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const said = t.search;
  const playlist = video.kind === 'playlist';
  // No colour of the theme's on the picture itself; see `Artwork`.
  const lead = video.thumbnail ? (
    <Image source={{ uri: video.thumbnail }} style={styles.thumbnail} contentFit="cover" />
  ) : (
    <View style={[styles.thumbnail, styles.thumbnailEmpty]} />
  );
  const subtitle = [video.channel, playlist ? said.playlist : durationLabel(video.duration)].filter(Boolean).join(' · ');
  if (playlist && onOpen) {
    return (
      <MediaRow
        lead={lead}
        title={video.title}
        subtitle={subtitle}
        shared={shared}
        off={openDisabled}
        accessibilityLabel={said.openPlaylistLabel(video.title)}
        onPress={onOpen}
        trailing={
          <Chevron />
        }
      />
    );
  }
  return (
    <MediaRow
      lead={lead}
      title={video.title}
      subtitle={subtitle}
      shared={shared}
      trailing={
        <View style={styles.actions}>
          {actions.map((action) => {
            const Icon = action.icon;
            return action.state === 'busy' ? (
              <RowControl key={action.accessibilityLabel} accessibilityLabel={action.accessibilityLabel}>
                {action.percent != null ? (
                  <Text style={styles.percent}>{t.format.percent(action.percent)}</Text>
                ) : (
                  <Busy color={c.textMuted} />
                )}
              </RowControl>
            ) : action.state === 'done' ? (
              <RowControl key={action.accessibilityLabel} accessibilityLabel={action.accessibilityLabel}>
                <TickIcon size={ICON} color={c.textMuted} />
              </RowControl>
            ) : (
              <RowControl
                key={action.accessibilityLabel}
                accessibilityLabel={action.accessibilityLabel}
                disabled={action.disabled}
                onPress={action.onPress}>
                <Icon size={ICON} color={action.disabled ? c.textDisabled : c.accent} />
              </RowControl>
            );
          })}
        </View>
      }
    />
  );
}

/** Looking, with the way to stop. */
export function Searching({ onCancel }: { onCancel: () => void }) {
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  return (
    <View style={styles.searching}>
      <Busy color={c.text} />
      <Text style={styles.muted}>{t.search.searching}</Text>
      <TextButton label={t.common.cancel} strong onPress={onCancel} />
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    // The size of a row's cover, the picture cropped to it.
    thumbnail: { width: ROW_COVER, height: ROW_COVER, borderRadius: RADIUS.cover },
    thumbnailEmpty: { backgroundColor: c.surfaceRaised },
    muted: { color: c.textMuted, fontSize: TYPE.hint, lineHeight: LEADING.small },
    actions: { flexDirection: 'row', alignItems: 'center' },
    // Figures of one width, so that it does not shuffle sideways as it counts.
    percent: { color: c.textMuted, fontSize: TYPE.label, fontVariant: ['tabular-nums'] },
    searching: { flexDirection: 'row', alignItems: 'center', gap: SPACE.m, marginVertical: SPACE.l },
  })
);
