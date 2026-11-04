import { common } from './common.ts';
import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const space: Strings['space'] = {
  title: '释放空间',
  rowNote: '从不听、常跳过或存了两份的歌曲，以及最大的文件',
  note: '这些歌曲可以删除，为手机腾出空间，每首都附有原因。勾选想删除的歌曲；删除之前 Android 会再确认一次。',
  groups: {
    copy: '同一首歌的副本',
    skipped: '经常跳过',
    neverPlayed: '从未播放',
    forgotten: '很久没有播放',
    large: '最大的文件',
  },
  groupSize: (count, size) => `${common.songs(count)} · ${size}`,
  megabytes: (mb) => `${format.decimal(mb, 1)} MB`,
  gigabytes: (gb) => `${format.decimal(gb, 1)} GB`,
  why: {
    copy: '这首歌的另一份副本会保留，收听记录转移到那一份',
    skipped: (skips, heard, after) =>
      heard === 0
        ? `跳过 ${format.number(skips)} 次，平均在第 ${format.number(after)} 秒，从未听完`
        : `跳过 ${format.number(skips)} 次，平均在第 ${format.number(after)} 秒，听完 ${format.number(heard)} 次`,
    neverPlayed: (added) => `从未播放，${format.date(new Date(added))} 起就在手机上`,
    forgotten: (last) => `上次播放于 ${format.date(new Date(last))}`,
    large: '最大的文件之一',
  },
  listSeparator: '、',
  inLists: (names) => `在歌单中：${names}`,
  showHint: '显示或隐藏这一组的歌曲',
  tickGroup: (group) => `全部“${group}”`,
  delete: (count, size) => `删除 ${common.songs(count)}（${size}）`,
  freed: (count, size) => `已删除 ${common.songs(count)}，释放了 ${size}。`,
  notDeleted: '没有删除任何内容。',
  empty: '没有可释放的空间：每首歌最近都播放过，没有经常跳过的，也没有存了两份的。',
  auto: {
    heading: '自动',
    title: '删除没听过的下载',
    off: '已关闭。Jukebox 自己下载的歌曲在一段时间没人听之后，可以自动删除。通过其他方式来的文件绝不会动。',
    after: (count) =>
      `Jukebox 自己下载的歌曲在 ${format.number(count)} 个月没人听之后会被删除，每天检查一次。绝不删除正在播放的歌曲，也不删除通过其他方式来的文件。`,
    months: '没人听的月数',
    monthCount: (count) => `${format.number(count)} 个月`,
    favorites: '收藏中的歌曲也删除',
    lists: '歌单中的歌曲也删除',
  },
};
