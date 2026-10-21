import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const lists: Strings['lists'] = {
  naming: {
    heading: 'リスト名を入力',
    placeholder: 'リスト名',
    create: '作成',
  },

  screen: {
    newList: '新規リスト',
    fromTag: 'タグから作成',
    empty: 'まだ何もありません。リストには、タグでは保存できない「自分で決めた曲順」を保存できます。',
    followingTag: (count, tag) => `${format.number(count)}曲 · 「${tag}」に連動`,
    fromListening: '再生履歴から',
    discover: 'ディスカバー',
    discoverHint: '再生した曲をもとに、まだ持っていない曲を紹介',

    tagSheet: {
      heading: 'タグからリストを作成',
      follows: 'タグに連動',
      copy: 'コピー',
      followsHint:
        'そのタグが付いた曲が常に表示されます。後でタグを付けた曲も追加されます。曲の並べ替えや削除はできません。',
      copyHint:
        '現時点でそのタグが付いている曲を取り込みます。以後タグとは連動しないため、リストは自由に並べ替えられます。',
      noTags: 'タグはまだありません。先に曲の情報を自動取得してください。',
    },
  },

  auto: {
    mostPlayed: { name: 'よく聴く曲', hint: '何度も聴いている曲' },
    recentlyFound: { name: '今月の新顔', hint: '今月になって初めて聴いた曲' },
    forgotten: { name: '忘れかけの曲', hint: 'かつてよく聴いていて、半年間聴いていない曲' },
    skipped: { name: 'よくスキップする曲', hint: 'つい「次へ」を押してしまう曲' },
  },

  picker: {
    heading: (count) => `${format.number(count)}曲をリストに追加`,
    noLists: 'リストはまだありません。',
    newList: '新規リスト…',
    already: (list) => `${list}に追加済み`,
    added: (count, list) => `${format.number(count)}曲を${list}に追加しました`,
  },

  trackPicker: {
    heading: '曲を追加',
    search: 'ライブラリを検索',
    alreadyHere: 'このリストに追加済み',
    add: (count) => `${format.number(count)}曲を追加`,
  },

  list: {
    album: 'アルバム',
    artist: 'アーティスト',
    folder: 'フォルダ',
    list: 'リスト',

    everythingTagged: (tag) => `現在「${tag}」タグが付いているすべての曲`,
    away: (count) => `ほかに${format.number(count)}曲が現在ライブラリにありません`,

    addTracks: '曲を追加',
    cover: 'カバー画像',
    deleteList: 'リストを削除',

    albums: 'アルバム',
    tracks: '曲',
    opensAlbum: 'アルバムを開きます',

    empty: {
      editable: 'まだ何もありません。上から曲を追加するか、ライブラリから曲を送ってください。',
      tag: 'このタグが付いた曲はまだありません。いくつかの曲にタグを付けると、ここに表示されます。',
      album: 'このアルバムはもうライブラリにありません。',
      artist: 'このアーティストの曲はもうライブラリにありません。',
      folder: 'このフォルダにはもう何もありません。',
      auto: '該当する曲はまだありません。まずは何曲か聴いてみてください。',
    },

    mightBelong: 'このリストに合いそうな曲',
    mightBelongHint:
      'リスト内の曲に多いタグから判断しています。ライブラリの半分に付いているようなタグより、珍しいタグほど重視されます。',

    choosePicture: '画像を選択…',
    firstFour: '最初の4曲のジャケットを使う',

    renameHeading: 'リスト名を変更',
    deleteQuestion: (name) => `「${name}」を削除しますか？`,
    deleteHint: 'リストは削除されますが、曲は端末に残ります。',
  },

  files: {
    importFiles: 'M3Uファイルをインポート…',
    exportAll: 'すべてのリストをエクスポート…',
    export: 'エクスポート…',
    untitled: 'インポートしたリスト',
    reading: 'M3Uファイルを読み込んでいます…',

    conflict: {
      heading: (name) => `「${name}」というリストはすでにあります`,
      hint: 'カバー画像はそのままでリストの中身をファイルの内容に置き換えるか、別のリストとして追加できます。',
      replace: '置き換え',
      keepBoth: (name) => `「${name}」として追加`,
      skip: 'このファイルをスキップ',
    },

    result: {
      heading: 'インポート完了',
      imported: (name, found, total) =>
        `リスト「${name}」をインポートしました：${format.number(total)}曲中${format.number(found)}曲が見つかりました`,
      repeated: (count) =>
        `${format.number(count)}曲がファイル内に複数回ありました。リストには1回だけ入ります。`,
      showMissing: (count) => `見つからなかった${format.number(count)}曲を表示`,
      hideMissing: '隠す',
      reasons: {
        notFound: 'ライブラリに該当する曲がありません',
        ambiguous: '該当する曲が複数あります',
        web: 'ファイルではなくWebアドレスです',
      },
      tooBig: (file) => `${file}はM3Uファイルとしては大きすぎます。`,
      unreadable: (file) => `${file}をM3Uファイルとして読み込めませんでした。`,
      empty: (file) => `${file}には何も入っていません。`,
      skipped: (file) => `${file}をスキップしました。`,
      encoding: (encoding) => `${encoding}として読み込み`,
      open: '開く',
    },

    exportSheet: {
      heading: 'M3Uファイルとしてエクスポート',
      headingAll: 'すべてのリストをエクスポート',
      phone: '端末上のパス',
      phoneHint:
        '/storage/emulated/0/Music/…のようなフルパスです。ファイルをどこに置いても、この端末の他のプレーヤーで読み込めます。',
      library: 'ライブラリフォルダから',
      libraryHint:
        'ライブラリフォルダの中から始まるパスです。同じ音楽があるパソコン向けで、ファイルはそのフォルダの一番上に置いてください。',
      save: '保存…',
      chooseFolder: 'フォルダを選択…',
      allHint:
        '選んだフォルダに、リストごとに.m3u8ファイルを1つずつ保存します。同じ名前のファイルがあれば置き換えられます。',
    },

    saved: (name) => `「${name}」をM3Uファイルとして保存しました`,
    savedAll: (count, folder) => `${format.number(count)}件のリストを${folder}に保存しました`,
    notSaved: (names) => `保存できませんでした：${names}`,
    leftOut: (count) => `${format.number(count)}曲は現在ライブラリフォルダにないため、含まれていません。`,
    failed: (reason) => `うまくいきませんでした：${reason}`,
  },
};
