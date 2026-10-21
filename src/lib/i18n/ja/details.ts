import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

/** `3件のファイル`, the form a count of files takes inside a sentence. */
const files = (count: number) => `${format.number(count)}件のファイル`;

/** What a file's fields are called in a line that says which were written. */
const FIELD_NAMES: Record<string, string> = {
  title: 'タイトル',
  artist: 'アーティスト',
  album: 'アルバム',
  albumArtist: 'アルバムアーティスト',
  genre: 'ジャンル',
  year: '年',
  track: 'トラック番号',
  disc: 'ディスク番号',
  cover: 'ジャケット',
};

/** Japanese lists with 、 throughout: タイトル、アーティスト、ジャケット. */
const listed = (items: string[]) => items.join('、');

export const details: Strings['details'] = {
  screen: {
    tabs: { general: '一般', tags: 'タグ', lyrics: '歌詞' },
    missing:
      'この曲はライブラリにありません。削除または移動されたか、Jukeboxが読み込んでいるフォルダの外にある可能性があります。',
    goBack: '戻る',
  },

  lookUp: '自動取得',
  searchFailed: '検索できませんでした。',

  general: {
    fields: {
      title: 'タイトル',
      artist: 'アーティスト',
      album: 'アルバム',
      albumArtist: 'アルバムアーティスト',
      year: 'リリース年',
      trackNumber: 'トラック番号',
      discNumber: 'ディスク番号',
    },
    notAYear: '有効な年ではありません。',
    notAPlace: '1以上の整数を入力してください。',

    chooseCoverLabel: 'ギャラリーからジャケットを選択',
    noCover: 'ジャケットなし',
    chooseFromGallery: 'ギャラリーから選択',
    removeCover: 'ジャケットを削除',
    keepCover: '元のジャケットに戻す',
    coverChosen: 'ジャケットを選択しました。保存すると反映されます。',

    lookUpHint:
      '下に入力されているタイトルとアーティストで検索し、見つかった情報（名前、アルバム、年、収録順、ジャケット）を入力します。',
    nothingFound: 'このタイトルとアーティストでは何も見つかりませんでした。',
    found: (sources, withCover) =>
      `${sources.join('と')}で見つかりました${withCover ? '（ジャケットを含む）' : ''}。内容を確認して保存してください。`,

    discard: '編集を破棄',
    saveHint:
      'ここで保存した内容は手動編集として扱われ、ライブラリを再度自動取得してもこの曲は上書きされません。',
    editGone: '編集を破棄しました。自動取得で再び入力できます。',

    inFile: 'ファイルへの書き込み',
    writeLabel: 'この情報をファイルに書き込む',
    writeToFile: 'ファイルに書き込む',
    saveFirst: '先に保存してください。ファイルに書き込まれるのは保存済みの内容だけです。',
    writeHint:
      'ライブラリに表示されているタイトル、アーティスト、アルバム、年、トラック番号、ディスク番号、' +
      'ジャンルとして最初のタグ、ここで保存したジャケットをファイル自体に書き込みます。' +
      'これにより、他のプレーヤーや他の端末でも表示されるようになります。変更の前にAndroidが確認を求めます。' +
      'ファイル内のそれ以外の情報はそのまま残り、歌詞は書き込まれません。',
    cannotWrite: '書き込めるのはMP3とFLACのファイルだけです。この曲の情報はアプリ内にのみ保存されます。',
    nothingWritten: '何も書き込まれませんでした。',
    couldNotWrite: '書き込めませんでした。',

    listening: '再生状況',
    timesPlayed: '再生回数',
    playedToEnd: '最後まで再生',
    timeSpent: '再生時間',
    firstPlayed: '初回再生',
    lastPlayed: '最終再生',
    never: 'なし',
    listenedSeconds: (seconds) => `${format.number(seconds)}秒`,
    listenedMinutes: (minutes) => `${format.number(minutes)}分`,
    listenedHours: (hours, minutes) => `${format.number(hours)}時間${minutes}分`,

    file: 'ファイル',
    name: '名前',
    folder: 'フォルダ',
    length: '長さ',
    detailsFrom: '情報の取得元',
    unknown: '不明',
    from: {
      notLookedUp: '未取得',
      yourEdit: '手動編集',
      notFound: '見つからず',
      lookup: '自動取得',
    },
  },

  tags: {
    lookUpHint:
      'この曲のタグを検索します。手動で入力したタグは残り、以前の自動取得で追加されたタグは今回見つかったものに置き換わります。',
    noneFound: 'この曲のタグは見つかりませんでした。',
    found: (count, source) =>
      `${source}からタグが${format.number(count)}件見つかりました。並べ替えてから保存してください。`,
    saveHint:
      '最初のタグがジャンルとして扱われます。手動で入力したタグは保持され、今後の自動取得で削除されることはありません。',
  },

  editor: {
    label: 'タグ',
    add: 'タグを追加',
    moveUp: (tag) => `${tag}を上へ移動`,
    moveDown: (tag) => `${tag}を下へ移動`,
    remove: (tag) => `${tag}を削除`,
  },

  tagPrompt: {
    heading: (count) => `${format.number(count)}曲にタグを追加`,
    placeholder: 'タグ',
  },

  lyrics: {
    lookUpHint:
      '再生時と同じ方法でこの曲の歌詞を検索し、見つかれば保存済みの歌詞と置き換えます。',
    nothingMatched: 'この曲に一致する歌詞はありませんでした。下の検索では候補を絞り込みません。',
    foundAndSaved: '歌詞が見つかり、保存しました。',
    nothingCameBack: '該当する結果はありませんでした。',
    cleared: 'クリアしました。次回の自動取得で再検索します。',
    notSeconds: '有効な秒数ではありません。',

    stored: '保存済みの歌詞',
    none: 'まだありません',
    kept: (timed, byHand, lines) =>
      `${timed ? '同期歌詞' : 'テキストのみ'}、${byHand ? '手動で選択' : 'LRCLIBから取得'}` +
      (lines > 0 ? ` · ${format.number(lines)}行` : ''),
    forget: 'この歌詞を破棄して再検索',
    saveChanges: '変更を保存',
    timedHint:
      '各行の先頭に時刻が付いています。歌詞は変更してもかまいませんが、角かっこは残してください。消すとその行の表示タイミングが失われます。',
    plainHint: '自由に変更できます。保存した歌詞は手動編集として扱われ、自動取得で置き換わることはありません。',

    timing: 'タイミング',
    timingHint:
      'すべての行をまとめてずらします。歌詞は正しいのに表示が早すぎる、または遅すぎるときに使います。プレーヤーを開いて合うまで少しずつ調整するか、数値をタップして入力してください。プラスにすると歌詞の表示が遅くなります。',
    earlier: (seconds) => `−${seconds}秒`,
    later: (seconds) => `+${seconds}秒`,
    shiftedEarlier: (written) => `−${written}秒`,
    shiftedLater: (written) => `+${written}秒`,
    noShift: 'ずれなし',
    reset: 'リセット',
    offsetHeading: '歌詞のずれは何秒ですか？',
    offsetPlaceholder: '秒数（例：1.5、-0.75）',
    typeOffset: 'ずれの秒数を入力',
    wordsField: '歌詞',

    byHand: '手動で検索',
    byHandHint:
      '自動検索と違い、ここでは候補を絞り込みません。自動検索は曲の長さが合わない結果をすべて除外するため、歌詞が見つからない曲があります。',
    queryPlaceholder: 'アーティストとタイトル',
    candidateTimed: '同期',
    candidatePlain: 'テキスト',

    paste: '貼り付け',
    pasteHint: 'LRCファイルまたはテキストの歌詞を貼り付けられます。タイムスタンプがあれば同期歌詞になります。',
    savePasted: '貼り付けた歌詞を保存',
  },

  library: {
    coversSaved: (count) => `アルバムジャケットを${format.number(count)}枚追加しました。`,
    stoppedOffline: (matched) =>
      `応答がなかったため、${format.number(matched)}曲が一致した時点で停止しました。残りの曲には何も書き込まれておらず、引き続き取得待ちです。`,
    serviceUnreachable: (service) =>
      `${service}に接続できなかったため、このサービスを使わずに続行しました。このサービスが必要な項目はそのままにしてあり、次回あらためて試します。`,
    stoppedUnexpectedly: '自動取得が予期せず停止しました。',

    nothingAnswered: '応答がありません。停止します。',
    rateLimited: 'サービスの一つから一時停止を求められました。1分後にもう一度問い合わせます。',
    lookingUp: '取得中…',
    lookingUpProgress: (done, total) =>
      `取得中… ${format.number(total)}曲中${format.number(done)}曲完了`,
    lookingUpAlbum: (album, done, total) =>
      `「${album}」を取得中… ${format.number(total)}曲中${format.number(done)}曲完了`,
    soFar: (matched, covers) =>
      `これまでに${format.number(matched)}曲が一致、ジャケット${format.number(covers)}枚`,
    stop: '停止',
    lookupChannel: '情報の検索',

    selected: (count) => `${format.number(count)}曲を選択中`,
    summary: (matched, edited, notFound, untried) =>
      [
        `一致${format.number(matched)}曲`,
        edited > 0 ? `編集済み${format.number(edited)}曲` : null,
        `見つからず${format.number(notFound)}曲`,
        `未取得${format.number(untried)}曲`,
      ]
        .filter(Boolean)
        .join(' · '),
    reset: 'リセット',
    lookUpMissing: '未取得分を取得',
    hint: '曲をタップすると手動で修正できます。チェックボックスを下へドラッグすると連続して選択できます。',
    searchPlaceholder: 'この中の曲を検索',

    noGenre: 'ジャンルなし',
    noMatch: '一致なし',
    notLookedUp: '未取得',
    /* Read aloud, so the two names are parted by 、 rather than a dash. */
    matchedSpoken: (artist, title) => `一致：${artist}、${title}`,
    manualSpoken: (artist, title) => `手動設定：${artist}、${title}`,
  },

  selection: {
    more: 'その他…',
    moreHint: '選択した曲に対してできる操作をすべて表示します',
    heading: (count) => `${format.number(count)}曲を選択中`,
    sections: { find: '自動取得', change: '編集', other: 'その他' },
    actions: {
      lookUp: {
        label: '曲の情報を自動取得',
        hint: '以前取得した情報を破棄して、ジャケットも含めて取得し直します。自分で編集した内容はそのまま残ります。',
      },
      covers: {
        label: 'ジャケットを自動取得',
        hint: 'ジャケットがない曲のジャケットだけを取得します。ほかの情報は取得し直しません。自分で選んだり外したりしたジャケットはそのままです。',
      },
      lyrics: {
        label: '歌詞を自動取得',
        hint: 'まずファイルと.lrcファイルから、次にLRCLIBから探します。自分で選んだ歌詞はそのままです。',
      },
      edit: {
        label: '情報をまとめて編集',
        hint: 'アーティスト、アルバムアーティスト、アルバム、リリース年をすべての曲にまとめて設定します',
      },
      addTag: { label: 'タグを追加', hint: 'ひとつのタグをすべての曲に追加します' },
      removeTag: { label: 'タグを削除', hint: 'タグをひとつ選んで、すべての曲から外します' },
      cover: { label: 'ジャケットを選択', hint: 'ギャラリーの画像をすべての曲に使います' },
      write: {
        label: 'ファイルに書き込む',
        hint: 'ライブラリに表示されている情報をファイル自体に書き込みます。先にAndroidが確認を求めます。',
      },
      addToList: { label: 'リストに追加', hint: '自分のリストのどれかに追加します' },
      reset: {
        label: 'リセット',
        hint: '自動取得で見つかった情報を破棄します。自分で編集した内容は残ります。',
      },
      delete: { label: '端末から削除', hint: 'ファイルを削除します。先にAndroidが確認を求めます。' },
    },
    busy: 'ほかの自動取得が進行中です。終わるまで待つか、停止してください。',

    editHeading: (count) => `${format.number(count)}曲を編集`,
    editHint:
      'すべての曲で同じにしたい項目だけを入力してください。空欄の項目は各曲のまま変わりません。すべての曲で項目を空にするには、その下のオプションをオンにしてください。タイトル、トラック番号、ディスク番号は変更されません。',
    keepEach: '各曲のまま',
    empty: '未入力',
    clearOn: { remove: 'すべての曲から削除', own: '各ファイルのアーティストを使用' },
    cleared: { remove: 'すべての曲から削除されます', own: '各ファイルのアーティスト' },
    edited: (count) =>
      `${format.number(count)}曲に保存しました。自分の編集として扱われ、自動取得で上書きされることはありません。`,

    tagAdded: (tag, count) => `${format.number(count)}曲に「${tag}」を追加しました。`,
    removeTagHeading: (count) => `${format.number(count)}曲からタグを削除`,
    tagOption: (tag, count) => `${tag} · ${format.number(count)}`,
    noTags: 'これらの曲にはタグがありません。',
    tagRemoved: (tag, count) => `${format.number(count)}曲から「${tag}」を外しました。`,

    resetQuestion: (count) => `${format.number(count)}曲をリセットしますか？`,
    resetBody:
      '自動取得で見つかった情報は破棄され、未取得として扱われます。自分で編集した内容は残ります。元に戻すことはできません。',

    coversProgress: (done, total) =>
      `ジャケットを取得中… ${format.number(total)}曲中${format.number(done)}曲完了`,
    coversNone: '新しいジャケットは見つかりませんでした。',
    lyricsProgress: (done, total) =>
      `歌詞を取得中… ${format.number(total)}曲中${format.number(done)}曲完了`,
    lyricsSoFar: (found) => `これまでに${format.number(found)}曲で見つかりました`,
    lyricsFound: (found, wanted, had) =>
      [
        wanted > 0
          ? `${format.number(wanted)}曲中${format.number(found)}曲で歌詞が見つかりました。`
          : null,
        had > 0 ? `${format.number(had)}曲にはすでに歌詞がありました。` : null,
      ]
        .filter(Boolean)
        .join('') || '探すものはありません。これらの曲の歌詞は自分で選んだものです。',
    lyricsOffline: 'LRCLIBに接続できなかったため、停止しました。残りはあとでもう一度試せます。',
  },

  write: {
    heading: (count) => `${files(count)}に情報を書き込みますか？`,
    body: (count) =>
      `${files(count)}が変更されます。ライブラリに表示されている各曲のタイトル、アーティスト、アルバム、年、` +
      'トラック番号、ディスク番号、ジャンルとして最初のタグ、保存済みのジャケットをファイル自体に書き込みます。' +
      'Androidが許可を求めます。ファイル内のそれ以外の情報はそのまま残ります。',
    noneHeading: 'どのファイルにも書き込めません',
    noneBody: '書き込めるのはMP3とFLACのファイルだけです。また、再生中の曲には書き込めません。',
    skipping: (otherKind, playing) =>
      otherKind > 0 && playing
        ? `他の形式の${files(otherKind)}と、再生中の曲はスキップされます。`
        : otherKind > 0
          ? `他の形式の${files(otherKind)}はスキップされます。`
          : '再生中の曲はスキップされます。',
    confirmLabel: (count) => `${files(count)}に情報を書き込む`,
    confirm: '書き込む',
    nothingWritten: '何も書き込まれませんでした。',
    couldNotStart: '開始できませんでした。',

    writing: 'ファイルに書き込み中',
    progressLabel: (done, total) => `${files(total)}中${format.number(done)}件を書き込み済み`,
    progress: (done, total) => `${format.number(done)} / ${format.number(total)}`,
    stopping: 'このファイルが終わりしだい停止します。',
    keepOpen: '各ファイルは元のファイルを変更する前に確認されます。アプリを開いたままにしてください。',
    stopLabel: '書き込み中のファイルが終わったら停止',
    stop: '停止',
    stoppedShort: (count) => `停止しました。${files(count)}は未処理です。`,

    written: (changed) =>
      changed.length > 0
        ? `書き込み完了：${listed(changed.map((name) => FIELD_NAMES[name] ?? name))}。`
        : '書き込み完了。',
    unchanged: 'すでにすべて同じ内容です。変更していません。',
    skippedPlaying: 'スキップ：再生中です。再生していないときにもう一度お試しください。',
    skippedFormat: 'スキップ：書き込めるのはMP3とFLACのファイルだけです。',
    failed: (reason) => `失敗：${reason}`,
    noReason: '書き込めませんでした。ファイルは変更されていません。',

    summary: (counts) => {
      const parts: string[] = [];
      if (counts.written > 0) parts.push(`書き込み${format.number(counts.written)}件`);
      if (counts.unchanged > 0) parts.push(`変更不要${format.number(counts.unchanged)}件`);
      if (counts.skipped > 0) parts.push(`スキップ${format.number(counts.skipped)}件`);
      if (counts.failed > 0) parts.push(`失敗${format.number(counts.failed)}件`);
      return parts.length > 0 ? parts.join(' · ') : '書き込むものはありません。';
    },
  },

  same: {
    note:
      'これらは同じ曲が2つのファイルに分かれているようです。統合すると、1つ目のファイルの再生記録、タグ、歌詞、リスト内の位置がすべて2つ目のファイルに移ります。別々のままにすると両方とも変更されず、この組み合わせについて再び確認されることはありません。',
    failed: (error) => `実行できませんでした。何も変更されていません。${error}`,
    empty: '確認が必要なものは残っていません。',
    from: '統合元',
    into: '統合先',
    keepApart: '別々のまま',
    merge: '統合',
    bulk: {
      mergeDelete: '統合して統合元のファイルを削除',
      deleteToo: '各ペアの統合元のファイルも削除',
      deleteNote: '削除する前にAndroidが確認します。',
      notDeleted: 'ファイルは削除されませんでした。',
      deleted: (count) => `${format.number(count)}個のファイルを削除しました。`,
      choose: 'このペアを選択',
      chosen: (count) => `${format.number(count)}組を選択中`,
      merge: (count) => `${format.number(count)}組を統合`,
      keepApart: (count) => `${format.number(count)}組を別々のまま`,
      confirm: (count) =>
        `${format.number(count)}組を統合しますか？${count === 1 ? '' : 'それぞれ'}1つ目のファイルの再生記録、タグ、歌詞、リスト内の位置が2つ目のファイルに移ります。元に戻すことはできません。`,
      done: (done, skipped) =>
        skipped > 0
          ? `${format.number(done)}組を処理しました。${format.number(skipped)}組は別の回答ですでに解決済みでした。`
          : `${format.number(done)}組を処理しました。`,
    },
    unknown: '不明',
    noFileName: 'ファイル名不明',
    holds: (side) => {
      const parts: string[] = [];
      if (side.listens > 0) parts.push(`再生${format.number(side.listens)}回`);
      if (side.tags > 0) parts.push(`タグ${format.number(side.tags)}件`);
      if (side.lyrics) parts.push('歌詞あり');
      if (side.lists > 0) parts.push(`リスト${format.number(side.lists)}件に収録`);
      return parts.length > 0 ? parts.join(' · ') : 'まだ何もありません';
    },
  },
};
