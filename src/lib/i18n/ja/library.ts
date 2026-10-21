import { common } from './common.ts';
import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const library: Strings['library'] = {
  views: {
    tracks: '曲',
    albums: 'アルバム',
    artists: 'アーティスト',
    folders: 'フォルダ',
  },

  nothingMatches: (query) => `「${query}」に一致するものはありません。`,
  noAlbums:
    'アルバムはまだありません。アルバムは曲の情報を自動取得した後に表示されます。ファイルが入っているフォルダはアルバムとして扱われません。',
  back: '‹ 戻る',
  trackMenu: '曲のオプション',
  albumMenu: 'アルバムのオプション',

  screen: {
    viewSwitch: 'ライブラリの表示',
    searchHints: {
      tracks: '曲・アーティスト・タグを検索',
      albums: '曲・アーティスト・タグを検索',
      artists: 'アーティストを検索',
      folders: 'フォルダを検索',
    },
    sort: '並べ替え',
    sortShort: { name: 'A–Z', added: '追加日', played: '再生日' },
    sortedBy: {
      name: '名前順',
      added: '追加日順',
      played: '最終再生日順',
    },
    sortHint: 'ライブラリの並び順を変更します',
    groupSortShort: { name: 'A–Z', tracks: '曲数', played: '再生数', added: '新着' },
    groupSortedBy: {
      name: '名前順',
      tracks: '曲数順',
      played: '再生回数順',
      added: '最近追加した順',
    },

    selectTracks: '曲を選択',
    stopSelecting: '選択を終了',
    selected: (count) => `${format.number(count)}曲を選択中`,
    addToList: 'リストに追加',
    addTag: 'タグを追加',
    writeToFiles: 'ファイルに書き込む',
    writeToFilesSpoken: '選択した曲の情報をファイルに書き込む',

    swipePlayNext: '次に再生',
    swipeQueue: 'キューに追加',
    queuedAll: (count) => `${common.tracks(count)}をキューに追加しました`,

    needsAccess: 'Jukeboxには、この端末の音楽ファイルへのアクセス許可が必要です。',
    nothingIn: (folder) => `${folder}には何もありません。`,
    shuffleAll: 'すべてシャッフル',
    playsEverythingBelow: 'Jukeboxはそのフォルダ以下の曲をサブフォルダも含めてすべて再生します。',
    chooseFolderInSettings: '設定でライブラリフォルダを選択してください。',

    folders: (count) => `フォルダ${format.number(count)}件`,
    noFolders: 'これらの曲には、どのフォルダにあるかの情報がありません。',
    shuffleTag: (tag) => `「${tag}」をシャッフル`,
  },

  row: {
    opensTracks: '曲を表示します',
    selectsTracks: 'すべての曲を選択します',
    select: '曲を選択',
  },

  rack: {
    open: (album) => `${album}を開く`,
    openHint: 'アルバムの曲を表示します',
    bringForward: 'このアルバムを手前に移動します',
  },

  albumActions: {
    select: { label: '選択', hint: 'このアルバムの曲と、続けてタップしたものを選択します' },
    rest: {
      label: 'このアルバムの残りの曲を探す',
      hint: 'このアルバムで、まだ持っていない曲',
    },
    lookUp: {
      label: 'このアルバムを自動取得',
      hint: '曲の情報とジャケットを、アルバム全体としてまとめて取得します',
    },
    cover: {
      label: 'アルバムのジャケットを選択',
      hint: 'ギャラリーの画像を、このアルバムのすべての曲に使います',
    },
  },

  albumTools: {
    lookingUp: (done, total) =>
      `アルバムを取得中… ${format.number(total)}曲中${format.number(done)}曲`,
    stop: '取得を停止',
    lookedUp: (found, covers) =>
      found === 0 && covers === 0
        ? 'このアルバムについて新しい情報は見つかりませんでした。'
        : covers === 0
          ? `${common.tracks(found)}の情報が見つかりました。`
          : found === 0
            ? `${common.tracks(covers)}のジャケットが見つかりました。`
            : `${common.tracks(found)}の情報と、${common.tracks(covers)}のジャケットが見つかりました。`,
    offline: '応答がありません。接続を確認して、もう一度お試しください。',
    failed: '自動取得が予期せず停止しました。',
    coverChosen: (count) => `${common.tracks(count)}にジャケットを設定しました。`,
  },

  rest: {
    looking: 'アルバムを検索しています…',
    release: (count, year) =>
      year ? `${common.tracks(count)}、${year}年` : common.tracks(count),
    have: (have, total) => `${format.number(total)}曲中${format.number(have)}曲がライブラリにあります。`,
    complete: 'アルバムの全曲がライブラリにあります。',
    rivals: 'この名前のアルバムは複数あります。お持ちの曲に最もよく合うものを表示しています。',
    unsure:
      'お持ちの曲がどれもこのアルバムで見つからなかったため、何もチェックしていません。まず正しいアルバムかどうか確認してください。',
    disc: (disc) => `ディスク${format.number(disc)}`,
    ordered: (count) => `${format.number(count)}曲をアルバムの曲順に並べました。`,
    undoOrder: '元に戻す',

    lookingTube: 'YouTubeで検索しています…',
    readingTube: 'アルバムを読み込んでいます…',
    source: {
      musicbrainz: '曲目リスト：MusicBrainz',
      youtube: (playlist, channel) =>
        `曲目リスト：YouTube（${[playlist, channel].filter(Boolean).join(' · ')}）`,
    },
    other: { youtube: '代わりにYouTubeで探す', musicbrainz: '代わりにMusicBrainzを使う' },
    onTrust:
      'YouTubeにある同名のアルバムから取得しました。お持ちの曲が少なく照合できないため、ダウンロードの前に内容を確認してください。',
    tubeNotFound: 'このアルバムと確認できるプレイリストはYouTubeにありませんでした。',

    ticks: 'ダウンロード予定',
    waiting: '順番待ち',
    searching: 'YouTubeで探しています…',
    noMatch: '一致する音源が見つかりませんでした',
    searchFailed: '検索できませんでした',
    byHand: '手動で検索',
    byHandLabel: (title) => `${title}を手動で検索`,

    download: (count) => `${format.number(count)}曲をダウンロード`,
    nothingTicked: 'ダウンロードする曲にチェックを入れてください',
    stop: '検索を停止',

    failed: {
      unnamed:
        'このアルバムは検索できません。アルバム名と、ほとんどの曲で共通するアーティストが必要です。',
      notFound: 'MusicBrainzには、このアーティストのこの名前のアルバムがありません。',
      offline: 'MusicBrainzに接続できませんでした。接続を確認して、もう一度お試しください。',
      throttled: 'MusicBrainzからアクセスを控えるよう求められました。1分ほど待ってから、もう一度お試しください。',
      failed: 'アルバムを検索できませんでした。',
      gone: 'このアルバムはもうライブラリにありません。',
      neither:
        'このアルバムは見つかりませんでした。MusicBrainzに登録がなく、このアルバムと確認できるプレイリストもYouTubeにありませんでした。',
      tube: 'YouTubeでアルバムを検索できませんでした。',
      tooOld: 'このバージョンのJukeboxではYouTubeでアルバムを検索できません。新しいAndroidアプリをインストールしてください。',
    },
  },

  menu: {
    playNext: { label: '次に再生', hint: '再生中の曲の直後に再生' },
    addToQueue: { label: common.addToQueue, hint: 'キューの最後に追加' },
    album: { label: 'アルバムへ移動', hint: 'アルバムの曲を収録順に表示' },
    addToPlaylist: { label: 'リストに追加', hint: '既存のリストか新しいリストに追加' },
    tiles: { label: 'ピアノタイルで遊ぶ', hint: 'この曲に合わせてタイルが落ちてきます' },
    details: {
      label: '詳細の表示と編集',
      hint: '名前、ジャケット、タグ、歌詞。それぞれ自動取得もできます',
    },
    delete: { label: '端末から削除', hint: 'この行だけでなく、ファイル自体を削除します' },
  },

  folders: {
    needsAccess:
      'フォルダを一覧表示するには、この端末の音楽ファイルへのアクセスをJukeboxに許可する必要があります。',
    note: 'Jukeboxは選んだフォルダ以下の曲をサブフォルダも含めてすべて再生します。着信音やゲームの音声を除外するには、サブフォルダを選んでください。',
    everything: (path) => `${path}（すべて）`,
  },

  leftOut: {
    title: '除外するフォルダ',
    none: 'なし。ボイスメッセージ、録音、着信音のフォルダをオフにできます。',
    some: (count) => `${format.number(count)}個のフォルダをライブラリから除外中`,
    note: 'オフにしたフォルダは、その中のフォルダも含めてライブラリから除外されます。何も削除されません。再生記録、タグ、リスト内の位置は保持され、オンに戻すと元どおりになります。',
    within: '親フォルダとともに除外中',
    spoken: (path, count) => `${path}、${format.number(count)}曲`,
    hint: 'オンでライブラリに含め、オフで除外します',
    empty: (root) => `${root}の中に、音楽が入ったフォルダはありません。`,
  },

  shortFiles: {
    title: '短いファイルを隠す',
    note: 'ボイスメッセージ、着信音、通知音を長さで除外します。何も削除されません。',
    under: (seconds) => `${format.number(seconds)}秒未満`,
    shorterThan: (seconds) => `${format.number(seconds)}秒未満`,
  },

  copies: {
    title: '同じ曲のコピー',
    some: (count) =>
      `ライブラリに複数ある曲が${format.number(count)}曲あります`,
    review: '確認',
    reviewHint: 'コピーを開いて、残すものを選びます',
    note: 'これらのファイルは、同じ録音が何度か保存されたもののようです。名前、またはアーティストとタイトルが同じで、長さの差が2秒以内です。それぞれ1つのコピーを残します。ほかのコピーを削除する前に、その再生記録、タグ、歌詞、リスト内の位置を残すコピーに移します。',
    empty: 'ライブラリに複数ある曲はありません。',
    cleanAll: (count) => `すべて整理（${format.number(count)}曲）`,
    confirmAll: (files, songs) =>
      `${format.number(files)}個のファイルを削除しますか？${format.number(songs)}曲それぞれ1つのコピーを残し、削除する各ファイルの再生記録、タグ、歌詞、リスト内の位置は先にそのコピーへ移します。削除する前にAndroidがもう一度確認します。`,
    confirm: (files) => `${format.number(files)}個のファイルを削除`,
    deleteOthers: (count) => (count === 1 ? 'もう1つのコピーを削除' : `ほかの${format.number(count)}個のコピーを削除`),
    different: '別の曲です',
    choose: '残すコピー',
    keepHint: 'このコピーを残し、ほかを削除します',
    keeps: '残す',
    goes: '削除',
    why: {
      listens: '再生回数が最も多いため、これをおすすめします。',
      described: '詳細またはジャケットがあるため、これをおすすめします。',
      folder: 'ライブラリフォルダにあるため、これをおすすめします。',
      larger: 'ファイルが大きいため、これをおすすめします。',
      older: 'ファイルが古いため、これをおすすめします。',
      alike: 'コピーはどれも同じです。どれを残しても構いません。',
    },
    yourChoice: '選んだコピーを残します。',
    holds: (copy) => {
      const parts = [copy.listens > 0 ? `再生${format.number(copy.listens)}回` : '再生なし'];
      if (copy.described) parts.push('詳細あり');
      if (copy.cover) parts.push('ジャケットあり');
      if (copy.outside) parts.push('ライブラリフォルダの外');
      return parts.join(' · ');
    },
    deleted: (count) => `${format.number(count)}個のファイルを削除しました。`,
    notDeleted: 'ファイルは削除されませんでした。再生記録などは、残すコピーに移っています。',
    failed: (error) => `一部の記録を移せなかったため、それらのファイルはそのままにしました。${error}`,
  },

  wrong: {
    title: '別の曲かもしれないダウンロード',
    some: (count) =>
      `名前とは別の曲かもしれないダウンロードが${format.number(count)}曲あります`,
    review: '確認',
    reviewHint: 'これらのダウンロードを開いて、1曲ずつ直します',
    note: 'これらは、ある曲としてダウンロードされてその曲名が付けられましたが、元の動画のタイトルは別のものです。別の曲かもしれません。再生して確かめてから、動画のタイトルに合わせて名前を付けるか、削除するか、正しいと伝えてください。選ぶまで何も変わりません。',
    empty: '別の曲のように見えるダウンロードはありません。',
    filedAs: '保存された名前',
    videoWas: '動画のタイトル',
    facts: (length, listens) => `${length}・${listens > 0 ? `再生${format.number(listens)}回` : '未再生'}`,
    playHint: 'このファイルを再生します',
    rename: '正しい名前にする',
    delete: '削除',
    right: 'これで正しい',
    sheetNote: '動画のタイトルから取りました。少し違う場合は直してください。あなたの編集として保存され、自動取得で上書きされることはありません。',
    titleField: 'タイトル',
    artistField: 'アーティスト',
    renamed: (title) => `「${title}」に名前を変えました。`,
    deleted: '削除しました。',
    notDeleted: 'ファイルは削除されませんでした。',
    keptRight: 'このままにします。今後は確認しません。',
    failed: (error) => `できませんでした。${error}`,
  },
};
