import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const backup: Strings['backup'] = {
  imported: 'インポートしました',
  importedBody:
    'すべて取り込みました。反映するにはJukeboxの再起動が必要です。いま画面に表示されている内容は、インポート前に読み込まれたものです。',
  restart: 'Jukeboxを再起動',

  question: 'このバックアップをインポートしますか？',
  made: (when, app) =>
    when
      ? app
        ? `${when}にJukebox ${app}で作成されたバックアップです。`
        : `${when}に作成されたバックアップです。`
      : app
        ? `Jukebox ${app}で作成されたバックアップです。`
        : 'バックアップです。',
  listens: (count) => `再生記録${format.number(count)}件`,
  tagged: (count) => `タグ付き${format.number(count)}曲`,
  withLyrics: (count) => `歌詞付き${format.number(count)}曲`,

  songs: (found, total) => {
    if (total === 0) return '曲は含まれていません。';
    const missing = total - found;
    const here = `含まれている${format.number(total)}曲のうち、${format.number(found)}曲がライブラリにあります。`;
    return missing > 0
      ? `${here}残りの${format.number(missing)}曲はこの端末にありません。それらの再生記録は保持されますが、タグ、歌詞、リスト内の位置は対応する曲がないため取り込まれません。`
      : here;
  },

  importing: 'インポート中…',
  merge: '統合',
  mergeHint: '現在のデータに追加します。この端末のデータは何も削除されません。',
  replace: '置き換え',
  replaceHint: '現在のデータを削除し、バックアップの内容に置き換えます。この操作は元に戻せません。',

  notABackup: 'このファイルはJukeboxのバックアップではありません。',
  newer: 'このバックアップは新しいバージョンのJukeboxで作成されています。読み込むにはアプリを更新してください。',
  needsBuildToExport: 'エクスポートするには、更新版のAndroidアプリをインストールしてください。',
  needsBuildToImport: 'インポートするには、更新版のAndroidアプリをインストールしてください。',
};
