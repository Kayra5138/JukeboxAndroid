import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const search: Strings['search'] = {
  modes: {
    discover: 'ディスカバー',
    download: 'ダウンロード',
    videos: '動画',
    playlists: 'プレイリスト',
  },

  tapes: {
    intro:
      'YouTubeのオーディオブック、ポッドキャスト、講演、長い録音を、ライブラリのTapesフォルダにダウンロードし、前回止めたところから再生します。検索するか、動画や再生リストのリンクを貼り付けてください。チャンネルのリンクならフォローできます。',
    placeholder: { videos: 'タイトル、番組名、またはYouTubeのリンク', playlist: '本、シリーズ、または再生リストのリンク' },
    empty: { videos: '本、番組、講演、講義を検索します。', playlist: '1本のカセットとしてダウンロードする再生リストを検索します。分冊の本や番組のシーズンなど。' },
    download: 'カセットとしてダウンロード',
    downloadBook: (count) => `${format.number(count)}本すべてを1本のカセットとしてダウンロード`,
    bookHint: 'リスト名のフォルダにリスト順の番号付きで保存され、続けて再生されます。',
    added: (name) => `Tapes/${name} にダウンロード中`,
    sources: { youtube: 'YouTube', podcasts: 'フォロー', books: '本', files: '端末' },
    /** Books from the Internet Archive: see `books/archive.ts`, `BooksPane` and the book screen. */
    /** Files on the phone brought into the Tapes folder: see `FilesPane`. */
    files: {
      intro: '端末にすでにある本や録音、講演をカセットのフォルダにコピーします。選んだファイルは元の場所に残ります。',
      choose: 'ファイルを選ぶ',
      chooseOther: 'ほかのファイルを選ぶ',
      folder: 'フォルダ名',
      folderPlaceholder: '本や録音の名前',
      folderNote: 'ライブラリのカセットフォルダにこの名前で、ファイル名の番号順に入ります。',
      copy: (count) => `${format.number(count)}件をカセットにコピー`,
      chosen: (count) => `${format.number(count)}件を選択`,
      copied: (done, of) => done === of ? `${format.number(done)}件をカセットにコピーしました。` : `${format.number(of)}件中${format.number(done)}件をコピーしました。残りは読み込めませんでした。`,
      failed: 'ファイルを1件もコピーできませんでした。',
      pickFailed: 'ファイルを選べませんでした。',
      toTapes: 'カセットへ',
    },
    books: {
      intro: '著作権の切れた本を LibriVox のボランティアが朗読したもので、Internet Archive で無料公開されています。題名や著者で検索するか、archive.org の聴けるもののアドレスを貼り付けてください。',
      placeholder: '題名、著者、archive.org のリンク',
      nothingFound: '本が見つかりませんでした。',
      searchFailed: 'Internet Archive を検索できませんでした。',
      anyLanguage: 'すべての言語',
      popular: 'よく聴かれている本',
      bookFailed: 'この本を Internet Archive から読み込めませんでした。',
      stats: (parts, minutes, here) => `${format.number(parts)}パート · ${minutes >= 60 ? `${format.number(Math.floor(minutes / 60))}時間${format.number(minutes % 60)}分` : `${format.number(minutes)}分`}${here > 0 ? ` · 端末に${format.number(here)}` : ''}`,
      fetchAll: '本をまるごと取得',
      fetchRest: (count) => `残りの${format.number(count)}パートを取得`,
      size: (mb) => `合計 約${format.number(mb)} MB`,
      parts: (count) => `${format.number(count)}パート`,
    },
    podcasts: {
      intro: 'ポッドキャストや YouTube チャンネルをフォローすると新しいエピソードが自動でカセットに届きます。開いて聴きたいエピソードだけ取得することもできます。検索するか、フィードやチャンネルのアドレスを貼り付けてください。',
      /** Under the button on a show not followed: that its episodes can be had without following it. */
      withoutFollowing: '聴くのにフォローは不要です。下から好きなエピソードを取得できます。フォローすると新しいエピソードが自動で届きます。',
      /** Where podcasts can be had from: said under the intro. */
      /** The title of a followed or followable show's own screen, a podcast or a YouTube channel. */
      showTitle: '番組',
      sources: '取得元：公開フィードのあるほぼすべてのポッドキャストを収録した Apple のポッドキャスト一覧（Spotify 配信の多くも含む）、Anchor・Buzzsprout・Libsyn・Podbean・SoundCloud などのフィードのアドレス、YouTube チャンネル。',
      placeholder: 'ポッドキャスト名、チャンネル名、またはリンク',
      searchFailed: 'ポッドキャストを検索できませんでした。接続を確認してください。',
      feedFailed: 'このポッドキャストのフィードを読み込めませんでした。',
      notChannel: 'YouTubeチャンネルのアドレスではないか、チャンネルが見つかりませんでした。',
      channelsHeading: 'YouTube チャンネル',
      podcastsHeading: 'ポッドキャスト',
      subscribers: (count) => `登録者 ${format.number(count)} 人`,
      channelsFailed: 'YouTube でチャンネルを検索できませんでした。',
      nothingFound: 'ポッドキャストが見つかりません。',
      yours: 'フォロー中のポッドキャスト',
      noneYet: 'まだポッドキャストをフォローしていません。',
      wifiOnly: '新しいエピソードはWi‑Fiのみ',
      wifiOnlyNote: 'フォロー中のポッドキャストのエピソードは、Wi‑Fi接続時のみ自動でダウンロードされます。手動ならいつでもダウンロードできます。',
      follow: 'フォロー',
      following: 'フォロー中',
      unfollow: 'フォローをやめる',
      autoDownload: '最新のエピソードを取得',
      autoDownloadNote: (keep) => `最新の${format.number(keep)}本をダウンロード済みにしておきます。`,
      keep: (count) => format.number(count),
      episodes: (count) => `エピソード · ${format.number(count)}`,
      noEpisodes: 'このフィードにはファイルのあるエピソードがありません。',
      download: 'ダウンロード',
      continue: '続きから再生',
      start: '再生する',
      more: 'もっと見る',
      less: '閉じる',
      stats: (total, here) => `${format.number(total)}エピソード · 端末に${format.number(here)}本`,
      play: '再生',
      /** The episodes shown by when they came out: see `podcasts/when.ts`. */
      when: { label: '期間', all: 'すべて', week: '過去1週間', month: '過去1か月', quarter: '過去3か月' },
      newest: '新しい順',
      oldest: '古い順',
      noneThen: 'この期間のエピソードはありません。',
      fetchNext: '次のエピソードを取得',
      fetchNextNote: (count) => `古いエピソードを聴いている間に、その後の${format.number(count)}本を取得し、聴き終えるたびに次を用意しておきます。`,
      line: (date, length) => [date, length].filter(Boolean).join(' · '),
    },
  },
  unavailable: {
    heading: 'YouTubeを使うにはアプリの更新が必要です',
    body: '音楽を検索・ダウンロードするには、更新版のAndroidアプリをインストールしてください。ライブラリは引き続き利用できます。',
    downloads: 'YouTubeからダウンロードするには、新しいAndroidアプリをインストールしてください。',
  },

  intro: {
    videos: 'YouTubeを検索するか、動画のリンクを貼り付けてください。音声をライブラリに保存できます。',
    playlist:
      'プレイリストを検索するか、YouTubeのリンクを貼り付けてください。結果を開くと、曲を試聴してダウンロードできます。確認されるのはプレイリストの最初の500件までです。',
  },
  inputLabel: {
    videos: 'YouTubeを検索、または動画のリンクを貼り付け',
    playlist: 'プレイリスト名またはYouTubeのリンク',
  },
  placeholder: {
    videos: '曲名、アーティスト、YouTubeのリンク',
    playlist: 'プレイリスト名またはYouTubeのリンク',
  },

  formats: { mp3: 'MP3', original: '元の音声' },
  formatHint: {
    mp3: 'ダウンロード後にMP3に変換します。',
    original: '可能な場合は元の音声コーデックのまま保存します。',
  },

  searching: 'YouTubeを検索しています…',
  results: (count) => `検索結果 · ${format.number(count)}件`,
  empty: {
    none: '結果が見つかりませんでした。別のキーワードかリンクをお試しください。',
    videos: '曲名とアーティストで検索して、目的の音源を探してください。',
    playlist: 'プレイリスト名で検索するか、プレイリストのリンクを貼り付けてください。',
  },

  playlist: 'プレイリスト',
  openPlaylist: 'プレイリストを開く',
  backToResults: '検索結果に戻る',
  openPlaylistLabel: (title) => `プレイリスト「${title}」を開く`,
  downloadLabel: (title) => `${title}をダウンロード`,
  download: { mp3: 'MP3をダウンロード', original: '音声をダウンロード' },
  adding: '追加中…',
  listen: '聴く',
  listenLabel: (title) => `${title} を保存せずに聴く`,
  readying: '準備中…',
  listenDrop: '保存しない',

  addingPlaylist: 'プレイリストを追加中…',
  downloadListed: {
    mp3: '一覧の曲をダウンロード · MP3',
    original: '一覧の曲をダウンロード · 元の音声',
  },
  listedHint:
    'ダウンロード済みまたは待機中の曲はスキップされます。非公開、削除済み、ライブ配信の動画は利用できない場合があります。',
  listCreated: (name) => `リスト「${name}」を作成しました。ダウンロードした曲はリストに表示されます。`,
  inLibrary: 'ライブラリにあります',
  alreadyHave: (count) => `${format.number(count)}曲はすでにライブラリにあったため、再ダウンロードしませんでした。`,
  unnamedPlaylist: 'YouTubeのプレイリスト',

  jobLine: (status, mp3) => `${status} · ${mp3 ? 'MP3' : '元の音声'}`,

  status: {
    finding: 'YouTubeで探しています',
    queued: '待機中',
    preparing: '準備中…',
    downloading: (percent) => `ダウンロード中 · ${percent}%`,
    converting: '音声を変換中…',
    saving: 'ライブラリに追加中…',
    cancelling: 'キャンセル中…',
    cancelled: 'キャンセル済み',
    failed: 'ダウンロード失敗',
    done: 'ライブラリに追加済み',
    listened: '再生可能・未保存',
    missing: 'ファイル削除済み',
  },

  failed: {
    search: '検索に失敗しました。もう一度お試しください。',
    queue: 'ダウンロードを追加できませんでした。',
    queuePlaylist: 'プレイリストを追加できませんでした。',
    cancel: 'ダウンロードをキャンセルできませんでした。',
    read: 'ダウンロードを読み込めませんでした。',
    readReopen: 'ダウンロードを読み込めませんでした。検索をもう一度開いてください。',
  },

  errors: {
    playlistLink: 'YouTubeのプレイリストのリンクを貼り付けるか、プレイリスト名で検索してください。',
    videoLink: '曲名か、有効なYouTube動画のリンクを入力してください。',
    queueFull: 'ダウンロードキューがいっぱいです。いくつかの曲が完了してから、もう一度お試しください。',
    update: 'YouTubeの仕様が変わり、このバージョンのダウンローダーではまだ読み取れません。ダウンロード画面で新しいバージョンを確認するか、Jukeboxを更新してください。',
    unavailable: 'この動画またはプレイリストは利用できません。別の公開プレイリストを試すか、検索してください。',
    unreachable: 'YouTubeに接続できませんでした。接続を確認して、もう一度お試しください。',
    refused: 'YouTubeでこのリクエストを完了できませんでした。後でもう一度試すか、別の結果を選んでください。',
  },
};
