import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const lyrics: Strings['lyrics'] = {
  none: '歌詞が見つかりませんでした。',
  translating: '翻訳中…',
  seekTo: (seconds) => `${seconds}秒の位置へ移動`,

  translation: {
    romaji:
      'この歌詞は日本語をローマ字で書いたもので、翻訳に使える元の表記の歌詞が見つかりませんでした。',
    unsupported: 'この言語には翻訳できません。',
    unavailable: 'この端末では翻訳を利用できません。',
    misaligned: '翻訳の行が歌詞と一致しませんでした。',
    failed: '翻訳に失敗しました。',
  },

  from: {
    file: 'ファイルから',
    lrc: '.lrcファイルから',
    lookup: 'LRCLIBから',
  },

  stored: (timed, from, lines) =>
    `${timed ? '同期歌詞' : 'テキストのみ'}、${from === 'file' ? 'ファイル自体から' : '隣の.lrcファイルから'}` +
    (lines > 0 ? ` · ${format.number(lines)}行` : ''),

  found: {
    file: 'ファイル自体で見つかり、保存しました。',
    lrc: '曲の隣の.lrcファイルで見つかり、保存しました。',
  },

  folders: {
    title: '曲の隣の.lrcファイルを読み込む',
    note: '曲と同じ名前の.lrcファイルにある歌詞を、オンラインで取得する前に表示します。Androidではアプリが読み込めるのは選択したフォルダ内のファイルだけなので、最初に一度、音楽のあるフォルダを選んでください。',
    add: 'フォルダを追加',
    remove: '削除',
    removeLabel: (folder) => `${folder}の.lrcファイルの読み込みをやめる`,
    elsewhere: 'このフォルダは端末上にないため、ライブラリの曲は含まれていません。端末上の音楽があるフォルダを選んでください。',
  },
};
