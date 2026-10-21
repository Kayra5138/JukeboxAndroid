import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

/*
  Japanese does not change a noun after a number; it puts a counter on the
  number instead: 3曲, アルバム3枚, アーティスト3人. Every count here is one
  wording.
*/
export const common: Strings['common'] = {
  cancel: 'キャンセル',
  save: '保存',
  done: '完了',
  ok: 'OK',
  close: '閉じる',
  back: '戻る',
  delete: '削除',
  remove: '外す',
  add: '追加',
  edit: '編集',
  rename: '名前を変更',
  yes: 'はい',
  no: 'いいえ',
  tryAgain: 'もう一度試す',
  retry: '再試行',
  import: 'インポート',
  clear: '選択解除',
  selectAll: 'すべて選択',
  off: 'オフ',
  saved: '保存しました。',
  loading: '読み込み中…',

  search: '検索',
  clearSearch: '検索をクリア',

  play: '再生',
  pause: '一時停止',
  nextTrack: '次の曲',
  previousTrack: '前の曲',
  shuffle: 'シャッフル',
  addToQueue: 'キューに追加',
  moveUp: '上へ移動',
  moveDown: '下へ移動',

  unknownArtist: '不明なアーティスト',
  unknownAlbum: '不明なアルバム',

  tracks: (count) => `${format.number(count)}曲`,
  songs: (count) => `${format.number(count)}曲`,
  albums: (count) => `アルバム${format.number(count)}枚`,
  artists: (count) => `アーティスト${format.number(count)}人`,
  lists: (count) => `リスト${format.number(count)}件`,
  files: (count) => `ファイル${format.number(count)}件`,
  minutes: (count) => `${format.number(count)}分`,
  hours: (count) => `${format.number(count)}時間`,

  fileUnreadable: 'このファイルを読み込めませんでした。',
  pictureFailed: 'この画像を読み込めませんでした。',

  drawFailed: 'この画面の表示中に問題が発生しました。',
};
