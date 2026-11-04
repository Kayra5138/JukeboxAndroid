import { common } from './common.ts';
import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const space: Strings['space'] = {
  title: '空き容量を増やす',
  rowNote: '聴かない曲、よくスキップする曲、重複した曲、いちばん大きいファイル',
  note: 'スマートフォンの空き容量を増やすために削除できる曲です。それぞれ理由を添えています。削除したい曲にチェックを入れてください。削除の前に Android がもう一度確認します。',
  groups: {
    copy: '同じ曲のコピー',
    skipped: 'よくスキップする曲',
    neverPlayed: '一度も再生していない曲',
    forgotten: '長いあいだ再生していない曲',
    large: 'いちばん大きいファイル',
  },
  groupSize: (count, size) => `${common.songs(count)}・${size}`,
  megabytes: (mb) => `${format.decimal(mb, 1)} MB`,
  gigabytes: (gb) => `${format.decimal(gb, 1)} GB`,
  why: {
    copy: 'この曲の別のコピーが残り、再生記録はそちらに移ります',
    skipped: (skips, heard, after) =>
      heard === 0
        ? `平均${format.number(after)}秒で${format.number(skips)}回スキップ、最後まで聴いたことはなし`
        : `平均${format.number(after)}秒で${format.number(skips)}回スキップ、最後まで聴いたのは${format.number(heard)}回`,
    neverPlayed: (added) => `未再生、${format.date(new Date(added))}からスマートフォンにあります`,
    forgotten: (last) => `最後の再生は${format.date(new Date(last))}`,
    large: 'いちばん大きいファイルのひとつ',
  },
  listSeparator: '、',
  inLists: (names) => `リスト：${names}`,
  showHint: 'このグループの曲を表示または非表示にします',
  tickGroup: (group) => `「${group}」をすべて`,
  delete: (count, size) => `${common.songs(count)}を削除（${size}）`,
  freed: (count, size) => `${common.songs(count)}を削除し、${size}の空きができました。`,
  notDeleted: '何も削除されませんでした。',
  empty: '空けられる容量はありません。どの曲も最近再生されていて、よくスキップされる曲も重複した曲もありません。',
  auto: {
    heading: '自動',
    title: '聴いていないダウンロードを削除',
    off: 'オフ。Jukebox が自分でダウンロードした曲は、しばらく誰も聴かなかったときに自動で削除できます。ほかの方法で入ったファイルには一切触れません。',
    after: (count) =>
      `Jukebox が自分でダウンロードした曲は、${format.number(count)}か月再生されないと削除されます。確認は1日1回です。再生中の曲や、ほかの方法で入ったファイルは削除しません。`,
    months: '再生されない月数',
    monthCount: (count) => `${format.number(count)}か月`,
    favorites: 'お気に入りの曲も対象にする',
    lists: 'リストの曲も対象にする',
  },
};
