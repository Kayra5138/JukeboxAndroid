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
  followed: (count) => `フォロー中の番組 ${format.number(count)} 件`,
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

  history: {
    title: '再生履歴をインポート',
    note: 'Last.fm、Spotify、Apple Music、ListenBrainzの再生記録を、それぞれでダウンロードできるファイルから取り込みます。見つかった内容が表示され、何かが変更される前に確認されます。',
    question: 'これらの再生記録をインポートしますか？',
    range: (from, to) => (from === to ? `すべて${from}の記録です。` : `${from}から${to}までの記録です。`),
    matched: (matched, total) =>
      `${format.number(total)}件のうち${format.number(matched)}件はライブラリにある曲の記録です。残りは曲名のまま保存され、統計にもそのまま数えられます。`,
    short: (count) => `30秒未満の${format.number(count)}件は除外されます。`,
    already: (count) => `すでに履歴にある${format.number(count)}件は除外されます。`,
    nothing: 'どの再生記録もすでに履歴にあるか、短すぎて数えられません。',
    added: (count) => `${format.number(count)}件の再生記録を履歴に追加しました。`,
    notHistory:
      'Jukeboxで読み込める再生履歴ではありません。Last.fm、Spotify、Apple Music、ListenBrainzから受け取ったファイル（CSVかJSON、またはそれらが入ったzip）を選んでください。',
    tooBig: 'このファイルは大きすぎて読み込めません。',
    failed: '再生記録をインポートできませんでした。何も変更されていません。',
  },
};
