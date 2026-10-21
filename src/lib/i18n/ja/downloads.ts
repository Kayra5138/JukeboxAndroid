import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const downloads: Strings['downloads'] = {
  short: (underWay, waiting, paused) => {
    if (paused) return waiting > 0 ? `一時停止中 · ${format.number(waiting)}件待機中` : '一時停止中';
    if (underWay > 0 && waiting > 0) {
      return `${format.number(underWay)}件ダウンロード中、${format.number(waiting)}件待機中`;
    }
    if (underWay > 0) return `${format.number(underWay)}件ダウンロード中`;
    return waiting > 0 ? `${format.number(waiting)}件待機中` : '';
  },
  state: (underWay, waiting, paused) => {
    if (paused) return waiting > 0 ? `一時停止中、${format.number(waiting)}件が待機中` : '一時停止中';
    if (underWay > 0 && waiting > 0) {
      return `${format.number(underWay)}件をダウンロード中、${format.number(waiting)}件が待機中`;
    }
    if (underWay > 0) return `${format.number(underWay)}件をダウンロード中`;
    return waiting > 0 ? `${format.number(waiting)}件が待機中` : 'ダウンロード中のものはありません';
  },
  pausedNote: '再開するまで新しいダウンロードは開始されません。すでにダウンロード中のものは最後まで続きます。',
  automaticNote: (count) =>
    `${format.number(count)}件のダウンロードはディスカバーによる自動ダウンロードです。他のダウンロードがすべて終わるまで待機します。`,

  pause: '一時停止',
  resume: '再開',
  cancelAll: 'すべてキャンセル',
  cancelAllQuestion: 'すべてのダウンロードをキャンセルしますか？',
  cancelAllHint: '待機中とダウンロード中のものがすべてキャンセルされます。すでにライブラリにある曲はそのまま残ります。',
  keep: 'キャンセルしない',

  sections: { now: 'ダウンロード中', next: '次の予定', history: '履歴' },
  clear: 'クリア',
  clearLabel: 'ダウンロード履歴をクリア',

  source: {
    discover: 'ディスカバー',
    search: '検索',
    album: (name) => `アルバム：${name}`,
    playlist: (name) => `プレイリスト：${name}`,
  },
  automatic: '自動 · 他の完了を待機中',
  retrying: (why) => (why ? `再試行中 · ${why}` : '再試行中'),

  doNext: '次にダウンロード',
  doNextLabel: (title) => `${title}を次にダウンロード`,
  cancelLabel: (title) => `${title}をキャンセル`,
  retryLabel: (title) => `${title}を再試行`,
  moveUp: '上へ移動',
  moveDown: '下へ移動',

  empty: {
    heading: 'ダウンロードはまだありません',
    body: '検索やディスカバーからダウンロードした曲や、アルバムを揃えるためにダウンロードした曲が、順番待ちのものと一緒にここに表示されます。',
  },
  unavailable: '音楽をダウンロードするには、新しいAndroidアプリをインストールしてください。',
  readFailed: 'ダウンロードを読み込めませんでした。',

  extractor: {
    heading: 'YouTubeダウンローダー',
    version: (version) => `yt-dlp ${version}`,
    current: '最新です',
    available: (version) => `${version}が利用可能です`,
    unchecked: '新しいバージョンをまだ確認していません',
    checked: (days) =>
      days === 0 ? '今日確認' : days === 1 ? '昨日確認' : `${format.number(days)}日前に確認`,
    check: 'アップデートを確認',
    checking: '確認中…',
    update: 'アップデート',
    waiting: '現在のダウンロードが終わるのを待っています…',
    downloading: (version, percent) => `${version}をダウンロード中 · ${format.number(percent)}%`,
    trying: '新しいバージョンを試しています…',
    restoring: 'Jukeboxに同梱のバージョンに戻しています…',
    updated: (version) => `${version}に更新しました。失敗したダウンロードを再試行できます。`,
    restore: (version) => `Jukeboxに同梱の${version}に戻す`,
    checkFailed: 'アップデートを確認できませんでした。',
    trouble: {
      network: 'GitHubに接続できませんでした。接続を確認して、もう一度お試しください。',
      answer: 'GitHubからリリース情報が返ってきませんでした。後でもう一度お試しください。',
      checksum: '受信したファイルがリリースに記載されたものと一致しません。何も変更されていません。',
      broken: '新しいバージョンはこの端末では動作しません。以前のバージョンがそのまま使われます。',
      failed: '更新できませんでした。以前のバージョンがそのまま使われます。',
    },
    rowUpdate: '更新',
    rowCheck: '確認',
    rowUpdateLabel: (title) => `YouTubeダウンローダーを更新して${title}を再試行`,
    rowCheckLabel: (title) => `新しいYouTubeダウンローダーを確認して${title}を再試行`,
  },

  button: {
    label: (state) => (state ? `ダウンロード：${state}` : 'ダウンロード'),
    finished: '完了',
    heading: 'ダウンロード',
    idle: '現在ダウンロード中のものはありません',
    paused: '一時停止中',
    allDone: 'すべて完了',
    waiting: (count) => `${format.number(count)}件待機中`,
    done: (count) => `${format.number(count)}件完了`,
    failed: (count) => `${format.number(count)}件失敗`,
    open: 'ダウンロードを開く',
  },
};
