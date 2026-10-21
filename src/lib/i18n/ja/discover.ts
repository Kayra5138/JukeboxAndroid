import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const discover: Strings['discover'] = {
  panel: {
    heading: '次に聴く曲のおすすめ',
    refresh: '更新',
    updated: (date) => `更新：${date}`,

    familiar: (because) => `よく聴くアーティストの曲 · ${because}`,
    fresh: (because) => `新しいアーティスト · ${because}`,
  },

  header: {
    notYet: 'リストはまだありません',
    about: 'ディスカバーについて',
    settings: 'ディスカバーの設定',
    findMore: 'さらに探す',
    dismiss: '閉じる',
  },

  about: {
    heading: 'ディスカバーについて',
    what:
      'まだライブラリにない曲を、過去30日間に再生した曲をもとに選びます。よく聴くアーティストの別の曲や、そのアーティストに近いアーティストの曲です。',
    source:
      '再生した曲の情報はこの端末内で読み取られます。おすすめはListenBrainzとMusicBrainzから取得し、曲の音声は再生するときにYouTubeから取得します。',
    keep: '「ライブラリに保存」を押すと、曲がライブラリに追加され、リストから外れます。',
    exclude:
      '「この曲は不要」を押すと、曲がリストから外れ、今後おすすめされなくなります。メニューからは、同じ指定をアーティスト単位で行えます。',
    room: 'どちらの場合も、空いた枠には別の曲が入ります。行を横にスワイプしても同じ操作ができ、長押しするとほかの操作も選べます。',
  },

  row: {
    keep: 'ライブラリに保存',
    exclude: 'この曲は不要',
    swipeKeep: '保存',
    swipeExclude: '不要',
    willPlay: '準備ができたら再生',
    preview: '試聴中 · 曲を取得しています',
    previewStop: '試聴を停止します。曲は準備ができしだい再生されます',
    willKeep: '準備ができたらライブラリへ',
    keeping: 'ライブラリに保存中…',
    failed: 'ダウンロード失敗 · タップして再試行',
    needsBuild: 'アプリの更新が必要です',
    waitingWifi: 'Wi-Fi待ち · タップしてダウンロード',
    percent: (percent) => `${format.number(percent)}%`,
    gettingReady: 'ダウンロード中',
    hint: '曲を再生します。必要ならまずダウンロードします',
    nowPlaying: (title) => `再生中：${title}`,
    menu: '曲のオプション',
  },

  menu: {
    play: { label: '再生', hint: '必要ならまずダウンロードします' },
    keep: { label: 'ライブラリに保存', hint: 'ライブラリに追加し、このリストから外します' },
    exclude: { label: 'この曲は不要', hint: 'リストから外し、今後おすすめしません' },
    neverArtist: {
      label: (artist) => `${artist}をおすすめしない`,
      hint: 'このアーティストの曲を今後おすすめしません',
    },
    why: 'この曲が選ばれた理由',
    seeds: (artists) => `${artists}の再生履歴から`,
    tags: (tags) => `タグ：${tags}`,
    freshArtist: 'ライブラリにない新しいアーティスト',
  },

  empty: {
    building: 'リストを作成しています…',
    none: 'リストはまだありません。「更新」を押すと、再生した曲をもとにディスカバーがリストを作成します。',
    findingMore: 'さらに曲を探しています…',
    short: (missing) => `空き枠が${format.number(missing)}件あります。`,
  },

  player: {
    kept: 'ライブラリに保存しました',
  },

  preview: {
    label: '試聴',
    note: '準備ができたら曲全体を再生します',
    stop: '試聴を停止',
  },

  settings: {
    heading: 'ディスカバー',
    title: 'ディスカバーの設定',
    count: 'おすすめの曲数',
    countNote: '半分はよく聴くアーティスト、半分は新しいアーティストです。保存または除外した曲はすぐに入れ替わります。',
    refresh: 'リストの更新',
    everyDays: (days) => `${format.number(days)}日`,
    manual: '手動',
    refreshNote:
      'バックグラウンド処理を実行するタイミングはAndroidが決めます。予定を過ぎた更新は、Jukeboxを再び開いたときにも実行されます。保存していないおすすめは入れ替わりますが、キューにある曲は再生に必要なくなるまで残ります。',
    ready: '次の曲を事前に準備',
    readyNone: 'なし',
    readyNote:
      'タップしてすぐ再生できるように、リストの先頭の曲や、再生中の曲の次の曲を事前にダウンロードします。「なし」の場合は、タップしたときに曲を取得します。',
    wifi: '事前の準備はWi-Fi接続時のみ',
    wifiNote: '従量制でないWi-Fiを使います。タップした曲は、接続の種類にかかわらずダウンロードします。',
    preview: 'ダウンロード中に試聴を再生',
    previewNote:
      'タップした曲の準備がまだのときは、Deezerの30秒の試聴をすぐに再生し、曲全体の取得が終わると最初から曲全体の再生に切り替えます。試聴は再生回数に含まれません。',
    nextList: '現在のリストはそのままです。次回のリストからこの設定で選ばれます。',
    excluded: '除外した曲',
    noneExcluded: '除外した曲はありません。',
    allowAgain: '除外を解除',
    allowAgainLabel: (title) => `${title}の除外を解除`,
    unblock: 'ブロックを解除',
    unblockLabel: (artist) => `${artist}のブロックを解除`,
    failed: 'ディスカバーの設定を更新できませんでした。もう一度お試しください。',
  },

  state: {
    idle: 'タップでダウンロードして再生',
    starting: '開始しています…',
    waitingFind: '検索待ち',
    waitingDownload: 'ダウンロード待ち',
    waitingRetry: 'まもなく再試行します',
    finding: '音源を探しています…',
    preparing: 'ダウンロードを開始しています…',
    downloading: (percent) => `ダウンロード中 · ${format.number(percent)}%`,
    converting: '仕上げています…',
    saving: 'まもなく完了…',
    ready: '再生できます',
    playing: '再生中',
    willPlay: (doing) => `${doing}（準備ができたら再生）`,
    preview: (doing) => `試聴中 · ${doing}`,
    willKeep: (doing) => `${doing}（準備ができたらライブラリに保存）`,
    keeping: 'ライブラリに保存中…',
    waitingWifi: 'Wi-Fi待ち · タップして今すぐダウンロード',
  },

  failure: {
    generic: 'このダウンロードを完了できませんでした。',
    fileMissing: 'ファイルがこの端末にありません。',
    noRecording: 'この曲の音源が見つかりませんでした。',
    notASong: 'この曲として見つかった動画は、ライブ配信か、曲にしては長すぎるものでした。',
    stopped: 'ダウンロードは停止されました。',
    needsBuild: 'ディスカバーの曲をダウンロードするには、更新版のAPKをインストールしてください。',
    retry: (reason) => `${reason}タップして再試行してください。`,
  },

  status: {
    building: '曲を探しています…',
    filling: (known, total) => `曲を確認中 · ${format.number(total)}曲中${format.number(known)}曲`,
    findingOffline: '接続がありません。リストの残りは接続が戻ったときに探します。',
    findingPaused: 'ダウンロードは一時停止中です。再開すると、リストの残りを探します。',
    findingLater: '一部の曲を確認できませんでした。ディスカバーが後でもう一度試します。',
    buildingArtists: (done, total) =>
      `曲を探しています · アーティスト${format.number(total)}人中${format.number(done)}人`,
    preparing: (ready, target) =>
      `新しいリストを準備中 · ${format.number(target)}曲中${format.number(ready)}曲の準備完了。${ready > 0 ? 'もう一度更新すると今すぐ表示できます。' : ''}`,
    offline: '接続がありません。リストはそのまま残ります。新しい曲は接続が戻ったときに探します。',
    offlineEmpty: '接続がありません。接続が戻ったら、ディスカバーがリストを作成します。',
    noLibrary: 'ディスカバーはこの端末にある音楽をもとにおすすめを探しますが、まだ音楽が見つかっていません。',
    noTaste:
      '曲にアーティストの情報がないため、ディスカバーが手がかりにできるアーティストがいません。「設定 → ライブラリ → タグ」で曲の情報を取得してください。',
    unreachable: 'おすすめを取得できませんでした。リストはそのまま残ります。後でもう一度お試しください。',
    unreachableEmpty: 'おすすめを取得できませんでした。後でもう一度お試しください。',
    exhausted: '新しい曲がまだ十分にありません。リストはそのまま残ります。',
    exhaustedEmpty: 'おすすめできる新しい曲はまだありません。もう少し再生してからもう一度お試しください。',
    timedOut: '曲の検索に時間がかかりすぎたため、停止しました。もう一度お試しください。',
    throttled: 'ディスカバーは先ほど検索したばかりです。1分後にもう一度お試しください。',
    failed: 'ディスカバーを完了できませんでした。もう一度お試しください。',
    waitingWifi: '次の曲はWi-Fi接続時にダウンロードします。今すぐダウンロードするには曲をタップしてください。',
    waitingConnection: '次の曲は接続が戻ったときにダウンロードします。',
    paused: 'ダウンロードは一時停止中です。曲を取得するには再開してください。',
  },

  notice: {
    kept: (title) => `${title}をライブラリに保存しました。`,
    excluded: (title) => `${title}は今後おすすめしません。`,
    excludedArtist: (artist) => `${artist}は今後おすすめしません。`,
    restored: (title) => `${title}をリストに戻しました。`,
    refreshed: '新しいリストができました。',
    keepFailed: (title) => `${title}をライブラリに保存できませんでした。もう一度お試しください。`,
    wrongFile: (title) => `${title}としてダウンロードしたファイルは別の曲でした。正しい曲を探して保存します。`,
    undo: '元に戻す',
  },

  engine: {
    needsTaste: 'ディスカバーが手がかりにできるアーティストもタグもありません。',
    nothingFetched:
      'おすすめを取得できませんでした。現在のディスカバーのリストはそのまま残ります。後でもう一度お試しください。',
  },

  taste: {
    popularity: '曲の知名度',
    popularityKnown: '有名な曲',
    popularityAny: '指定なし',
    popularityDeep: '隠れた名曲',
    popularityNote:
      '有名なアーティストとその定番曲を中心にするか、あまり知られていないアーティストや曲を中心にするかを選びます。「指定なし」の場合、新しいアーティストはその代表曲の一つで紹介されます。',

    neverArtistLabel: (artist) => `${artist}を今後おすすめしない`,
    blockedArtists: 'ブロックしたアーティスト',
    noneBlockedArtists: 'ブロックしたアーティストはいません。',
    blockedArtistsNote:
      '曲を除外すると、そのアーティストもおすすめされにくくなります。同じアーティストの曲を3曲除外すると、ディスカバーはそのアーティストを6か月間おすすめしません。',
  },

  why: {
    moreFrom: (artist) => `${artist}の他の曲`,
    becauseYouPlay: (artists) => `${artists}をよく聴いているため`,
    both: (first, second) => `${first}と${second}`,
    like: (artist) => `${artist}に近い`,
    withGenre: (line, genre) => `${line} · ${genre}`,
    fromTags: (tags) => `よく聴く${tags}から`,
    unexplained: 'あなたへのおすすめ',
    veryNear: 'よく聴く曲にとても近い',
    near: 'よく聴く曲に近い',
    farther: '少し幅を広げて',
  },

  gathering: {
    around: (artist, done, total) =>
      `${artist}の周辺を探索中 · アーティスト${format.number(total)}人中${format.number(done)}人`,
    artists: (done, total) => `アーティスト${format.number(total)}人中${format.number(done)}人`,
    naming: '曲名を確認しています…',
    offline: '接続がありません。接続が戻ったら、ディスカバーが新しい曲を探します。',
    throttled: 'おすすめサービスからアクセスを控えるよう求められました。数分後にもう一度お試しください。',
    nothing: '今回は新しい曲が見つかりませんでした。現在のディスカバーのリストはそのまま残ります。後でもう一度お試しください。',
  },
};
