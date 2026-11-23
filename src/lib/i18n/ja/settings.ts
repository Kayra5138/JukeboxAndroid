import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const settings: Strings['settings'] = {
  lastBuilt: (when) => `最終ビルド：${when}`,
  lastBuiltUnknown: '最終ビルド：新しいAPKをインストールすると表示されます',

  sections: {
    look: '外観と操作感',
    sound: 'サウンド',
    player: 'プレーヤー',
    miniPlayer: 'ミニプレーヤー',
    tapes: 'カセット',
    library: 'ライブラリ',
    downloads: 'ダウンロードとディスカバー',
    data: 'データ',
    views: 'ライブラリの表示',
    experimental: '試験運用',
  },
  categories: {
    look: 'テーマ、アニメーション、バイブレーション、ライブラリで使う表示の種類。',
    sound: 'イコライザーとエフェクト、音量の均一化、クロスフェード、速度とピッチ。',
    player: 'スキップボタンで移動する秒数、キューが終わるときに続けて流す曲、歌詞の翻訳先の言語。',
    miniPlayer: '再生中バーの表示内容、ボタン、見た目と操作。',
    tapes: 'スマート巻き戻し、カセットのスキップボタンの秒数、ポッドキャストを Wi‑Fi のときだけ取得する設定。',
    library: '音楽があるフォルダ、タグとジャケット、同じ曲かもしれないファイル。',
    waiting: (count) => `${format.number(count)}件が確認待ち`,
    downloads: 'ダウンロードキューとフローティングボタン、ディスカバー、YouTubeダウンローダーの更新。',
    data: 'データのバックアップとインポート、アップデートの確認、ListenBrainz（試験運用）。',
  },

  /** Finding a setting by a word it is shown with, on any page however far in: the field over Settings and its page. */
  /** Settings → Look & feel: whether the bar to take hold of beside a long list is there always, while it moves, or never. */
  scrollBar: { title: 'スクロールバー', note: '長いリストの横にあるバー。つかんで一気に遠くまで移動できます。', always: '常に表示', moving: 'スクロール中', never: '表示しない' },
  /** Settings → Library: whether a list's page says what else might belong in it. */
  listSuggestions: { title: 'リストの下のおすすめ', note: 'リストの曲の下に、そのリストのタグをもとに、ライブラリから合いそうな曲を表示します。' },
  /** Settings → Look & feel: whether a song taken out can be had back for a moment after. */
  undoOffers: { title: '外したあとに元に戻す', note: '曲をリストから外したり、プレーヤーで手放したり、ディスカバーで除外したりしたあと数秒間、元に戻すボタンを表示します。' },
  search: {
    open: '設定を検索',
    title: '設定を検索',
    placeholder: '設定にある言葉',
    none: (query: string) => `「${query}」を含む設定はありません。`,
  },
  language: {
    title: '言語',
    note: 'アプリの表示言語です。端末の言語設定には連動しません。',
  },
  theme: {
    title: 'テーマ',
    open: 'カラー、グラス、または自作のテーマ。',
    note: '「システム」は端末のライト／ダーク設定に従います。',
    pair: {
      light: 'ライトモード時',
      dark: 'ダークモード時',
      note: '「システム」で端末の設定に合わせて切り替える2つのテーマです。',
    },
    shuffle: {
      title: '起動ごとに違うテーマ',
      on: 'オン',
      toggle: 'アプリを開くたびにランダムに選ぶ',
      note: '選択候補にするテーマにチェックを入れてください。選ばれたテーマは次にアプリを開くまで使われます。その間も手動で変更できます。',
      empty: 'この機能を使うには、テーマを1つ以上チェックしてください。',
    },
  },
  customTheme: {
    open: 'カスタムテーマの色',
    openNote: 'カスタムテーマの背景色とアクセントカラーを選びます。その他の色はこの2色から自動で決まります。',
    preview: 'プレビュー',
    background: '背景',
    accent: 'アクセント',
    surface: 'カード',
    automatic: '自動',
    automaticNote: '背景色から自動で決定',
    presets: 'おすすめの色',
    hue: '色相',
    saturation: '彩度',
    lightness: '明度',
    degrees: (value) => `${value}°`,
    hex: 'カラーコード',
    nudged: (colour) => `文字が読みやすいよう、${colour}で表示しています。`,
    note:
      '文字の色はこれらの色から自動で決まるため、常に読みやすく表示されます。同じ理由で、選んだ色が少し明るく、または暗く調整されることがあります。',
    use: 'このテーマを使う',
    reset: 'リセット',
    sample: {
      title: '曲のタイトル',
      line: 'アーティスト · アルバム',
      chip: 'シャッフル',
      button: '再生',
    },
  },

  tags: { note: '曲の情報とアルバムジャケット' },
  favoritesShown: { title: "お気に入り", note: "常にあるリスト（新しい順）。プレーヤーのハートと曲のメニューの「お気に入りに追加」で追加します。オフにすると3つとも隠れ、中身はそのまま残ります。" },
  listButton: {
    title: 'リストに追加ボタン',
    note:
      'プレーヤーに表示され、再生中の曲をメニューを開かずにリストへ追加できるボタンです。',
  },
  autoplaySizes: { title: '一度に追加する似た曲', library: 'ライブラリから', fresh: 'Discover の新曲', note: 'キューを補充するたびに追加する曲数。「似た曲で再生を続ける」と、似た曲と一緒に再生した曲の両方に使います。新曲は1曲ごとにダウンロードされます。ミックスはそれぞれの4分の3です。' },
  tap: {
    title: '曲をタップしたとき',
    note: 'Tracks や検索結果で曲をタップしたあとに流れるもの。',
    sheetNote: 'アルバムやリストの上の Play と Shuffle、Shuffle all、Discover は変わりません。各曲のメニューから一度だけ「似た曲と一緒に再生」「この曲だけ再生」も選べます。',
    list: { label: 'リストの残り', note: 'その後の曲を表示順に。' },
    shuffled: { label: 'リストの残りをシャッフル', note: 'まずこの曲、そのあとリストの他の曲をランダムに。' },
    similar: { label: '似た曲', note: 'この曲のあと、選んだ取得元（ライブラリまたは Discover）から似た曲をまとめて追加。その後は「似た曲で再生を続ける」の設定に従って続きます。' },
    only: { label: 'その曲だけ', note: 'あとには何も流れません（「似た曲で再生を続ける」が追加する場合を除く）。' },
    source: { title: '似た曲の取得元', note: 'タップした曲のあとに流れる最初の曲の取得元。その後は「似た曲で再生を続ける」が引き継ぎます。' },
    everywhere: { title: 'アルバムやリストでも', note: 'アルバム、リスト、アーティスト、フォルダのページで曲をタップしたときも。オフならそれらは元の順で再生。' },
  },
  autoplay: {
    title: '似た曲で再生を続ける',
    note: 'キューが終わりに近づくと、聴いていた曲に似た曲をキューの最後に追加します。',
    sheetNote: '終わる数曲前に追加するので、画面がロックされていてもキューのほかの曲と同じように続けて再生されます。リピートがオンのときは追加しません。',
    off: {
      label: 'オフ',
      note: '何も追加しません。キューの最後で再生が止まります。',
    },
    library: {
      label: 'ライブラリから',
      note: 'タグ、アーティスト、一緒に聴いている曲をもとに選びます。オフラインでも使えます。',
    },
    fresh: {
      label: '新しい曲',
      note: 'まだ持っていない曲をディスカバーが見つけます。ディスカバーと同じくネットワークとYouTubeからのダウンロードを使い、ディスカバーのWi-Fi設定に従います。',
    },
    mixed: {
      label: 'ミックス',
      note: 'ライブラリから2曲、続いて新しい曲を1曲。新しい曲はディスカバーと同じくネットワークとYouTubeからのダウンロードを使い、ディスカバーのWi-Fi設定に従います。',
    },
  },
  downloads: {
    listen: { title: '聴いて保存していない曲', note: '保存しない限り（ハート、リストに追加、メニューから保存）、取得からこの日数で削除されます。', days: (days) => `${format.number(days)}日`  },
    note: 'ダウンロード中、待機中、完了済みのもの。',
    button: {
      title: 'フローティングダウンロードボタン',
      note: 'ダウンロード中とその後数分間、アプリの上に丸いボタンを表示します。タップすると進み具合を確認できます。',
    },
    check: {
      title: '新しいYouTubeダウンローダーを確認',
      note: '1日に1回まで、ダウンロード画面を開いたときかダウンロードしたときにだけ、最新のyt-dlpをGitHubに問い合わせます。ユーザーやライブラリに関する情報は送信されず、許可するまで何もダウンロードされません。',
    },
  },
  discover: { note: 'リストの曲数、更新の頻度、除外したもの。' },
  /** What stands where the cover is in the player: Settings → Player. See `ui/coverLook.ts`. */
  /** Settings → Look & feel, under the theme: the row that opens how the player looks. */
  playerLook: { title: 'プレーヤーの見た目', open: 'カバーの代わりに表示するものと、音楽に合わせて動くもの。' },
  coverLook: {
    songs: '曲',
    tapes: 'テープ',
    cover: 'カバー',
    record: 'レコード',
    cassette: 'カセット',
    note: 'プレーヤーでカバーの代わりに表示するもの。レコードは再生中に回転し、カセットはパートが進むにつれてテープを片方のリールからもう片方へ巻き取ります。「装飾の動きを止める」がオンのときはどちらも止まります。',
    tonearm: 'トーンアーム',
    tonearmNote: 'レコードの上のアーム。曲が進むにつれて針が外側からラベルへ進みます。',
    motion: '音楽に合わせて',
    none: 'なし',
    spectrum: 'スペクトラム',
    ripple: '波紋',
    breathe: '呼吸',
    scope: 'オシロスコープ',
    motionNote: 'その周りで音楽に合わせて動くもの。聞こえている音と同時に、ヘッドホンでも。再生中でプレーヤーが開いているときだけ。',
    punch: 'パンチ',
    spectrogram: 'スペクトログラム',
    sparks: 'スパーク',
    aurora: 'オーロラ',
    notes: {
      spectrum: '音の高さごとの大きさを示すバー。レコードでは周りに光線。',
      ripple: 'ビートのたびに縁から広がる輪。',
      breathe: '音楽に合わせて少し大きくなり、後ろが光ります。',
      punch: 'ビートのたびに少し大きくなり、元に戻ります。',
      scope: '音そのものの波形。',
      spectrogram: '直近数秒のすべての音の高さが流れていきます。',
      sparks: 'ビートのたびに縁からプレーヤー全体へ飛び散る火花。',
      aurora: 'プレーヤー全体の後ろに、カバーの色の雲。それぞれ音の一部に合わせて膨らみます。',
    },
  },
  still: {
    title: '装飾の動きを止める',
    note:
      'コマ落ちする端末向けです。ページやシートはアニメーションなしで開き、カバーはフェードインせず、レコードとビジュアライザーは止まり、ガラスはぼかしなしで描かれます。',
  },
  scriptNames: { title: '他の文字での名前', latin: 'ローマ字', original: 'オリジナル', note: '検索で曲名がローマ字と元の文字（日本語・中国語・韓国語）の両方で見つかったとき、ライブラリにどちらを表示するか。以前に検索した曲は、もう一度検索すると埋まります。' },
  haptics: {
    title: "バイブレーション",
    open: "指で触れたときにアプリがどれだけ、どの強さで振動するか。",
    mode: "振動",
    modes: { off: "オフ", essential: "基本のみ", all: "すべて", custom: "カスタム" },
    modeNotes: {
      off: "アプリは振動しません。",
      essential: "最も意味のある場面だけ：長押し、操作の成否、ゲーム。",
      all: "長押しとドラッグ、スイッチと選択、スライダーの目盛り、結果、プレーヤーのボタン、ゲーム。",
      custom: "下で振動させる場面を選びます。",
    },
    strength: "強さ",
    strengthNote: "指を離したときに確認できます。100%が推奨です。それを超えると同じ振動が強くなり、200%を超えるとモーターを最大の強さで動かします。強さを変えられないモーターの端末では、そこまでは端末の強さのままです。",
    /** Beside the strength where it is the one the app comes with and suggests. */
    recommended: "推奨",
    groupsHeading: "振動する場面",
    groups: {
      holds: { title: "長押しとドラッグ", note: "長押しの反応、移動するために持ち上げた行、チェックボックスをなぞる指。" },
      choices: { title: "スイッチと選択", note: "スイッチ、選択のタブ、選んだ項目。" },
      notches: { title: "目盛りとステップ", note: "通常速度、0 dB、スライダーの中央、グラフの列。" },
      results: { title: "結果", note: "操作が成功したかどうか：見つかった、書き込んだ、追加した、読み込んだ。" },
      player: { title: "プレーヤーのボタン", note: "再生、スキップ、リピート、ハート、歌詞の行をタップ。" },
      fun: { title: "ゲームとお楽しみ", note: "Piano Tiles のキーなど。" },
    },
    phone: "端末の設定でタッチ操作のフィードバックがオフなら、アプリも振動しません。",
  },
  moreButton: {
    title: '各行の3点ボタン',
    note:
      '曲とアルバムの各行の右端に表示され、長押しと同じメニューを開きます。オフにしても長押しは使えます。',
  },
  miniPlayer: {
    shows: '表示内容',
    progress: {
      title: '進行状況',
      none: 'なし',
      line: 'ライン',
      fill: '塗りつぶし',
      note: '曲のどのあたりか。下端の細いライン、または曲の進行に合わせてバー全体が塗られていきます。',
    },
    line: {
      title: '曲名の下',
      artist: 'アーティスト',
      album: 'アルバム',
      both: 'アーティストとアルバム',
      left: '残り時間',
      next: '次の曲',
      note: '2行目に表示する内容。',
    },
    cover: {
      title: 'カバー',
      square: '四角',
      round: '丸',
      record: 'レコード',
      note: 'レコードは再生中に回ります。',
    },
    buttons: {
      title: 'ボタン',
      aside: '最大4つまで。ここに並んだ順に表示されます。',
      names: {
        previous: '前へ',
        playPause: '再生・一時停止',
        next: '次へ',
        back: '戻る',
        forward: '進む',
        heart: 'お気に入り',
        shuffle: 'シャッフル',
        repeat: 'リピート',
      },
    },
    handling: '操作',
    swipe: {
      title: 'スワイプで曲を切り替え',
      note: '横に引くと前後の曲に移ります。オフにするとプレーヤーを開くだけになります。',
    },
    hold: {
      title: '長押しで開くもの',
      none: 'なし',
      menu: '曲のメニュー',
      queue: 'キュー',
      lyrics: '歌詞',
      note: 'バーの曲を長押ししたときの動作。',
    },
    look: '見た目',
    floating: {
      title: 'フローティング',
      note: '画面幅いっぱいではなく、角を丸めて端から離して表示します。',
    },
    tint: {
      title: 'カバーの色',
      note: '再生中の曲のカバーの色で染めます。',
    },
    leftHanded: {
      title: '左利き',
      note: 'ボタンを左に、曲を右に表示します。',
    },
  },
  tabs: {
    title: 'タブ',
    notes: {
      library: '曲、アルバム、アーティスト、カセット、フォルダ。',
      lists: 'プレイリスト、スマートリスト、お気に入り。',
      search: 'ディスカバーとYouTubeからのダウンロード。このタブを非表示にすると、どちらも一緒に隠れます。',
      stats: '聴いた記録と、リスニングレポート。',
      settings: 'アプリの見た目、音、動作。',
    },
    aside: 'ライブラリと設定は常に表示されます。',
    names: 'アイコンの下に名前',
    namesNote: 'オフにすると、バーにはアイコンだけが表示され、少し低くなります。横向きでは常にそうなります。',
  },

  views: {
    notes: {
      tracks: 'すべての曲を1行ずつ表示します。',
      albums: 'タグの情報からまとめたアルバムです。',
      artists: '曲にクレジットされているすべてのアーティストです。2人のアーティストの曲は両方に表示されます。',
      folders: 'ライブラリフォルダ以下の、ファイルが保存されているフォルダです。',
      tapes: 'ライブラリフォルダ内の「Tapes」フォルダにあるオーディオブック、ポッドキャスト、長い録音。前回止めたところから続きを再生します。',
    },
    onlyHint: 'オンの表示がこれだけなので、オフにできません',
    toggleHint: 'ライブラリでのこの表示のオン／オフを切り替えます',
    asideOne: '表示が1つだけのときは、ライブラリにその表示だけが出て切り替えスイッチは出ません。1つは常にオンになります。',
    asideMany: 'ライブラリの切り替えスイッチには、オンにした表示が並びます。1つは常にオンになります。',
  },

  sameSong: {
    note: (count) =>
      `すでにある曲と同じ曲に見えるファイルが${format.number(count)}件あります。確認するまで、再生履歴は別々に保たれます。`,
  },
  exportAll: {
    title: 'すべてエクスポート',
    note:
      '再生履歴、リスト、タグ、歌詞、設定、フォロー中のポッドキャスト、各カセットの再生位置とマークを、指定した場所に1つのファイルとして保存します。音楽ファイル自体は含まれません。',
    failed: 'バックアップを保存できませんでした。',
  },
  autoBackup: {
    title: '自動バックアップ',
    off: '「すべてエクスポート」と同じファイルを、毎日または毎週、選んだフォルダに自動で保存します。',
    folder: 'フォルダ',
    folderUnnamed: '選択したフォルダ',
    chooseOther: '別のフォルダを選ぶ',
    lost: 'このフォルダにアクセスできなくなりました。移動・削除されたか、権限が取り消された可能性があります。バックアップを続けるには、もう一度フォルダを選んでください。',
    chooseAgain: 'フォルダを選び直す',
    every: '頻度',
    daily: '毎日',
    weekly: '毎週',
    keep: '保持するバックアップ数',
    keepNote: (count) =>
      `フォルダには最新の${format.number(count)}個を残し、それより古いものは削除します。フォルダ内のほかのファイルには触れません。`,
    last: (when) => `前回のバックアップ：${when}`,
    never: 'まだバックアップはありません。',
    failed: '前回のバックアップを作成できませんでした。次の機会にもう一度試します。',
    now: '今すぐバックアップ',
    made: 'バックアップしました。',
  },
  importBackup: {
    title: 'インポート',
    note: 'バックアップを取り込みます。内容が表示され、何かが変更される前に確認されます。',
    failed: 'インポートに失敗しました。',
    refused: (reason) => `${reason}この端末では何も変更されていません。`,
  },

  playback: {
    title: '再生',
    note: (speed) => `速度とピッチ · ${speed}×`,
  },
  equalizer: { note: 'バンド、低音、サラウンド、ラウドネス' },
  effects: { note: '広がり、クロスフィード、回転、レベル' },
  /** The tape settings, apart from the music's: see `app/settings-tapes.tsx`. */
  tapes: {
    smartRewind: {
      title: 'スマート巻き戻し',
      note: 'しばらくしてから再生したカセットは、止めた位置より少し前から始まります。離れていた時間が長いほど前に戻ります。短い休憩なら3秒、1日たてば30秒。オフにすると止めた位置からそのまま再生します。',
    },
    skipSilence: { title: '無音をスキップ', note: '話の間の無音を飛ばし、カセットが少し短くなります。音楽には影響しません。' },
    voiceClarity: { title: '声をはっきり', note: '声の下の低いうなりを抑え、言葉を聞き分ける帯域を少し持ち上げます（イコライザーに重ねて）。カセット再生中のみ。' },
    skipSponsors: { title: 'スポンサーをスキップ', note: 'YouTube から取得したカセットで、SponsorBlock の利用者が印を付けた部分（スポンサー紹介、自己宣伝、登録のお願い）を飛ばします。' },
    back: '戻る秒数',
    forward: '進む秒数',
    jumpNote: 'カセット再生中に再生ボタンの両側のボタンで移動する秒数。音楽の設定は「プレーヤー」にあります。',
    podcasts: 'ポッドキャスト',
    deletePlayed: {
      title: '聴いたエピソードを削除',
      off: 'フォロー中のポッドキャストのエピソードは、聴いた後も端末に残ります。',
      after: (days) => `フォロー中のポッドキャストのエピソードは、アプリで取得したものなら、最後まで聴いてから${format.number(days)}日後に削除されます。マークを付けたものは残ります。`,
    },
    /** The podcasts followed, as an OPML file: see `podcasts/opml.ts`. */
    opml: {
      heading: 'ポッドキャストの移行',
      export: 'フォロー中のポッドキャストを保存',
      exportNote: 'ほかのポッドキャストアプリでも読めるOPMLファイルとして保存します。',
      import: 'ファイルからフォロー',
      importNote: 'ほかのポッドキャストアプリのOPMLファイル。番組はフォローされますが、自動では何も取得しません。必要な番組ごとに画面で有効にしてください。',
      importing: (done, total) => `${format.number(total)}件中${format.number(done)}件を読み込み中…`,
      imported: (followed, already, failed) => [`${format.number(followed)}件をフォローしました。`, already > 0 ? `${format.number(already)}件はフォロー済みでした。` : '', failed > 0 ? `${format.number(failed)}件は読み込めませんでした。` : ''].filter(Boolean).join(''),
      nothing: 'このファイルにはポッドキャストがありません。',
      failed: 'ファイルを読み書きできませんでした。',
      none: 'まだポッドキャストをフォローしていません。',
      saved: (count) => `${format.number(count)}件のポッドキャストを保存しました。`,
    },
  },
  jump: {
    title: 'スキップ秒数',
    note: '再生ボタンの両側にある2つのボタンで、曲の中を何秒移動するかを設定します。',
  },
  crossfade: { note: '曲から次の曲へのつなぎ方' },
  loudness: {
    title: '音量を均一化',
    note:
      '小さい曲は大きく、大きい曲は小さくします。アルバムを曲順どおりに再生するときは、アルバム内の音量差がそのまま保たれます。',
  },
  lyricsLanguage: {
    title: '歌詞の翻訳先',
    note:
      '歌詞は端末内で翻訳されます。英語以外の言語へは英語を経由して翻訳され、初回は2つ目のモデルをダウンロードします。',
  },
};
