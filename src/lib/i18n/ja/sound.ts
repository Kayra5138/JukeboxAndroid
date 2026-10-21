import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const sound: Strings['sound'] = {
  percent: (value) => `${format.number(value)}%`,

  effects: {
    failures: {
      unsupported: 'エフェクトを使うには、更新版のAndroidアプリをインストールしてください。',
      unreadable: 'エフェクトを読み込めませんでした。再試行するまでオフになります。',
      unsent: 'この設定はプレーヤーに反映されませんでした。',
    },
    title: 'エフェクト',
    presets: {
      off: { name: 'オフ', hint: '録音そのままの音' },
      mono: { name: 'モノラル', hint: '左右同じ音。イヤホン片耳用' },
      wide: { name: 'ワイド', hint: '左右の広がりを強調' },
      headphones: { name: 'ヘッドホン', hint: '左右に極端に振られたミックスを聴きやすく' },
      '8d': { name: '8D', hint: '音がゆっくりと周りを回ります' },
      karaoke: { name: 'カラオケ風', hint: '中央の音を遠ざけます' },
    },
    voices: {
      off: { name: 'オフ', hint: '録音そのままの音' },
      robot: { name: 'ロボット', hint: '低い音と掛け合わせた、金属的で鐘のような音' },
      vintage: { name: 'ヴィンテージ', hint: 'ビット数とサンプリングレートを落とし、高音をカット' },
      swirl: { name: 'うずまき', hint: 'ジェット機が頭上を通るような、ゆっくりしたうねり' },
      chipmunk: { name: 'ヘリウム', hint: '5度上げ、テンポはそのまま' },
      squeak: { name: 'もっとヘリウム', hint: '1オクターブ上げ。もはや人の声ではありません' },
    },
    ownSettings: 'カスタム設定',
    howMuch: '効果の量',
    voiceNote:
      'どのボイスも原曲の倍音を残したまま変化させるので、曲の土台はそのままです。効果の量を下げると、録音そのままの音がより多く聞こえます。',

    stereo: 'ステレオ',
    width: '広がり',
    mono: 'モノラル',
    asRecorded: '録音どおり',
    balance: 'バランス',
    centre: '中央',
    left: (percent) => `左${percent}%`,
    right: (percent) => `右${percent}%`,
    swap: { title: '左右チャンネルを入れ替え', note: '左右を逆にします。配線が逆のケーブル用です。' },

    headphones: 'ヘッドホン',
    crossfeed: 'クロスフィード',
    crossfeedNote:
      'スピーカーで聴くときのように、各チャンネルの音を少しだけ、遅らせてこもらせた状態で反対側の耳に届けます。左右に極端に振られた古いミックスの聴き疲れを和らげます。スピーカーではほとんど効果がありません。',

    rotation: '回転',
    depth: '深さ',
    turnTakes: '1周の時間',
    seconds: (count) => `${count}秒`,
    rotationNote:
      'いわゆる8Dです。音がゆっくりと周りを回ります。ヘッドホン向けで、スピーカーでは音量が揺れるだけです。',

    level: 'レベル',
    preamp: 'プリアンプ',
    decibels: (value) => `${value > 0 ? '+' : ''}${format.decimal(value, 1)} dB`,
    levelNote:
      '広がりやイコライザーで音が割れる場合は、これを下げてください。音割れは、最も大きなピークが上限に収まりきらないために起きます。',
  },

  transitions: {
    missing: 'このバージョンのアプリには、まだトランジション機能がありません。',
    title: 'クロスフェード',
    about: '曲の再生を続けたまま次の曲を始めるので、曲のつなぎ目が聞こえません。',
    betweenTracks: '曲と曲の間',
    overlap: '重なり',
    overlapNote:
      '終わりかけの曲に次の曲をどれだけ重ねるかを設定します。0にすると、通常どおり曲が終わってから次の曲が始まります。',
    albums: {
      title: 'アルバム内ではクロスフェードしない',
      note:
        '同じアルバムの連続した曲の間ではクロスフェードしません。ライブ盤や、曲が切れ目なく続くように作られたアルバムは、そのつなぎ目まで含めて作品です。',
    },
    others: {
      manualMs: {
        label: 'スキップ',
        hint:
          '「次へ」または「前へ」を押したとき。短めにしてください。ボタンの反応が遅いと、操作している感覚が薄れます。',
      },
      pauseMs: {
        label: '一時停止と再開',
        hint: '止めるときと再開するときの音の途切れを和らげます。',
      },
      seekMs: {
        label: 'シーク',
        hint: '再生バーをドラッグした後。これがないと波形の途中に着地して、プツッと音がします。',
      },
    },
    equalPower: {
      title: '等パワーカーブ',
      note:
        '半分の音量の2曲を重ねても、合わせた大きさは半分にはなりません。このカーブは重なりの間も音量を一定に保ちます。直線のカーブでは途中で音量が落ち込みます。',
    },
    fewer: '設定を減らす',
    more: 'その他のトランジション',
    reset: 'デフォルトに戻す',
    seconds: (written) => `${written}秒`,
  },

  equalizer: {
    missing: 'このバージョンのアプリには、まだイコライザーがありません。',
    title: 'イコライザー',
    attached: '再生中の音に反映しています。',
    saved: '保存しました。再生を始めるとすぐに反映されます。',
    carried:
      '端末のイコライザーの設定を引き継ぎ、プリセットに「端末のイコライザー」として保存しました。このイコライザーのバンドで同じ形を再現したもので、ブーストする分の余裕を確保するようになったため、以前より少し音が小さく聞こえる場合があります。',
    lost:
      '端末のイコライザーの設定を引き継げませんでした。バンドを周波数に対応付けられなかったためです。このイコライザーはフラットな状態から始まります。',

    presets: 'プリセット',
    saveAs: '名前を付けて保存…',
    rename: '名前を変更…',
    confirmDelete: (name) => `「${name}」を削除しますか？`,
    importAutoEq: 'AutoEQからインポート…',
    keptAs: (name) => `「${name}」として保存しました。`,
    renamedTo: (name) => `「${name}」に名前を変更しました。`,

    bands: 'バンド',
    noBands:
      'バンドがないのでフラット、つまり録音されたままの音です。バンドを追加するか、プリセットを選ぶか、ヘッドホン用の補正をインポートしてください。',
    addBand: 'バンドを追加',
    full: (most) => `追加できるバンドは${most}個までです。`,

    preamp: 'プリアンプ',
    automatic: '自動',
    byHand: '手動',
    nothingBoosted: 'ブーストしている帯域がないため、余裕を確保するための音量の引き下げはしていません。',
    turnedDown: (by) =>
      `全体の音量を${by}下げています。これはカーブで最も大きくブーストしている量と同じで、ブーストしても音割れしないために必要な余裕です。`,
    typeIt: (now) => `入力 · ${now}`,
    typePreamp: (now) => `プリアンプを入力（現在${now}）`,
    clipsAbove: (level) => `${level}を超えると、最も大きな部分で音割れすることがあります。`,
    lowEnough: '十分に低いので、このカーブでブーストしても音割れしません。',

    unbuilt:
      'このバージョンのアプリはまだ端末のイコライザーで再生していますが、この画面からは設定できなくなりました。バンドは次のバージョンで使えるようになります。下のコントロールは今までどおり使えます。',

    tone: 'トーン',
    bassBoost: '低音ブースト',
    surround: 'サラウンド',
    loudness: 'ラウドネス',
    toneNote:
      'この3つは端末に備わったエフェクトで、バンドの後に適用されます。ラウドネスは音色を変えずに小さい録音の音量を上げます。上げすぎると、大きな部分で音が割れます。',
    resetAll: 'すべてリセット',

    prompt: {
      keepCurveAs: 'このカーブの保存名',
      keepCorrectionAs: 'この補正の保存名',
      namePlaceholder: '名前（使うヘッドホンの名前など）',
      keep: '保存',
      aName: '名前',
      set: '設定',
      preampHint: (least, most) => `デシベル単位で${least}〜${most}。`,
      frequency: (band) => `バンド${band}の周波数`,
      frequencyHint: (least, most) =>
        `ヘルツ単位で${least}〜${most}。1.2kと入力すると1200になります。`,
      gain: (band) => `バンド${band}のゲイン`,
      gainHint: (most) => `デシベル単位で-${most}〜${most}。`,
      q: (band) => `バンド${band}のQ`,
      qHint: (least, most) => `${least}〜${most}。`,
    },
  },

  presets: {
    builtIn: {
      Flat: 'フラット',
      'More bass': '低音強調',
      'Less boom': 'こもり軽減',
      Warm: 'ウォーム',
      'Voices forward': 'ボーカル強調',
      'More air': '高音の抜け',
      'Quiet listening': '小音量リスニング',
    },
    myCurve: 'マイカーブ',
  },

  band: {
    types: { peak: 'ピーク', lowShelf: 'ローシェルフ', highShelf: 'ハイシェルフ' },
    said: (band, type, frequency, gain, q) =>
      `バンド${band}：${type}、${frequency}、${gain}、Q ${q}`,
    closes: 'このバンドを閉じます',
    opens: 'このバンドを開いて変更します',
    kind: (band, type) => `バンド${band}の種類：${type}`,
    frequency: '周波数',
    gain: 'ゲイン',
    widthQ: '幅（Q）',
    cornerQ: '傾き（Q）',
    peakHint: 'Qが大きいほど帯域が狭くなります。1で1オクターブ強、10で1音程度です。',
    shelfHint:
      'シェルフは、周波数より片側の帯域全体を上げ下げします。Qは境目の急さで、0.7が一般的です。',
    typeIt: '入力',
    typeFrequency: (band, now) => `バンド${band}の周波数を入力（現在${now}）`,
    typeGain: (band, now) => `バンド${band}のゲインを入力（現在${now}）`,
    typeQ: (band, now) => `バンド${band}のQを入力（現在${now}）`,
    remove: (band) => `バンド${band}を削除`,
    removeThis: 'このバンドを削除',
  },

  curve: {
    label: (said) => `周波数特性カーブ。${said}`,
    flat: 'フラット：何も上げ下げしていません。',
    highest: (level, near) => `最大${level}（${near}付近）。`,
    lowest: (level, near) => `最小${level}（${near}付近）。`,
    highestAndLowest: (high, highNear, low, lowNear) =>
      `最大${high}（${highNear}付近）、最小${low}（${lowNear}付近）。`,
  },

  autoEq: {
    title: 'AutoEQからインポート',
    about: 'ヘッドホンのParametricEQ.txtの内容を貼り付けるか、ファイルを選択してください。',
    textLabel: 'ParametricEQファイルのテキスト',
    chooseFile: 'ファイルを選択…',

    graphic:
      'これは別の種類のイコライザー用のGraphicEQファイルです。ParametricEQ.txtを使ってください。',
    noneSupported: 'このテキストには、このイコライザーで使える種類のフィルターがありません。',
    noneFound:
      'このテキストにフィルターが見つかりませんでした。各行は「Filter 1: ON PK Fc 105 Hz Gain -3.4 dB Q 0.70」のような形式です。',
    imported: (count) => `${count}個のバンドをインポートしました。`,
    leftOut: (count, room) => `ほかの${count}個は追加できませんでした（上限は${room}個です）。`,
    unsupported: (count) =>
      `${count}個のフィルターは、このイコライザーにない種類のためスキップしました。`,
    adjusted: (count) =>
      `${count}個はバンドに設定できる範囲を超えていたため、範囲内に収めました。`,
  },
};
