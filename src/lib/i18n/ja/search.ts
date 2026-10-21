import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const search: Strings['search'] = {
  modes: {
    discover: 'ディスカバー',
    download: 'ダウンロード',
    videos: '動画',
    playlists: 'プレイリスト',
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
  openPlaylistLabel: (title) => `プレイリスト「${title}」を開く`,
  downloadLabel: (title) => `${title}をダウンロード`,
  download: { mp3: 'MP3をダウンロード', original: '音声をダウンロード' },
  adding: '追加中…',

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
