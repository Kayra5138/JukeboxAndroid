import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const sound: Strings['sound'] = {
  percent: (value) => `${format.number(value)}%`,

  effects: {
    failures: {
      unsupported: '请安装新版应用以使用音效。',
      unreadable: '无法读取音效设置。在重试之前，音效保持关闭。',
      unsent: '该设置未能传达到播放器。',
    },
    title: '音效',
    presets: {
      off: { name: '关闭', hint: '原汁原味的录音' },
      mono: { name: '单声道', hint: '左右耳相同——适合只戴一只耳机' },
      wide: { name: '宽广', hint: '声场向两侧扩展' },
      headphones: { name: '耳机', hint: '让极端声像的混音不再“钻进脑袋”' },
      '8d': { name: '8D', hint: '声音缓缓环绕着你旋转' },
      karaoke: { name: '类卡拉 OK', hint: '削弱中间的人声' },
    },
    voices: {
      off: { name: '关闭', hint: '原汁原味的录音' },
      robot: { name: '机器人', hint: '与低频音做环形调制——金属感，如钟声' },
      vintage: { name: '复古', hint: '更低的位深、更粗糙的采样率，并削去高频' },
      swirl: { name: '漩涡', hint: '缓慢的扫频，像喷气机从头顶飞过' },
      chipmunk: { name: '花栗鼠', hint: '升高五度，速度不变' },
      squeak: { name: '超级花栗鼠', hint: '升高整整一个八度，已经不像人声' },
    },
    ownSettings: '你的自定义设置',
    howMuch: '强度',
    voiceNote: '每种变声效果都保留并改变录音自身的泛音，因此底下仍是原来的歌。调低强度，可以听到更多原始录音。',

    stereo: '立体声',
    width: '宽度',
    mono: '单声道',
    asRecorded: '原始',
    balance: '声道平衡',
    centre: '居中',
    left: (percent) => `偏左 ${percent}%`,
    right: (percent) => `偏右 ${percent}%`,
    swap: { title: '交换声道', note: '左右声道互换。适用于接错线的情况。' },

    headphones: '耳机',
    crossfeed: '交叉馈送',
    crossfeedNote:
      '让每个声道的一小部分声音延迟、柔化后传到另一侧耳朵，就像用音箱听时那样。可以缓解老式极端声像混音带来的听觉疲劳。用音箱播放时没有实际作用。',

    rotation: '旋转',
    depth: '深度',
    turnTakes: '旋转一周用时',
    seconds: (count) => `${count} 秒`,
    rotationNote: '也就是人们常说的 8D：声音缓缓环绕着你旋转。专为耳机设计——用音箱播放只会听到音量忽大忽小。',

    level: '电平',
    preamp: '前置增益',
    decibels: (value) => `${value > 0 ? '+' : ''}${format.decimal(value, 1)} dB`,
    levelNote: '如果拓宽声场或均衡器让声音出现爆音，请调低此项：那是最响的峰值超出了余量。',
  },

  transitions: {
    missing: '此版本的应用尚不支持过渡效果。',
    title: '交叉淡化',
    about: '上一首还在播放时，下一首就已开始，让你听不到衔接的痕迹。',
    betweenTracks: '歌曲之间',
    overlap: '重叠时长',
    overlapNote: '下一首与上一首重叠播放的时长。设为零则歌曲按正常方式结束。',
    albums: {
      title: '专辑内不做交叉淡化',
      note: '同一张专辑中相邻的歌曲之间不做交叉淡化。现场专辑或本就连续混音的作品，衔接本该如此。',
    },
    others: {
      manualMs: {
        label: '切歌',
        hint: '手动按下一首或上一首时。请设短一些——按钮响应太慢会让人觉得不跟手。',
      },
      pauseMs: {
        label: '暂停和继续',
        hint: '让停止和重新开始都更柔和。',
      },
      seekMs: {
        label: '拖动进度',
        hint: '拖动进度条之后。否则会从波形中间切入，产生咔嗒声。',
      },
    },
    equalPower: {
      title: '等功率曲线',
      note: '两首各为一半音量的歌曲叠加起来并不等于原来一半的响度。这条曲线能在重叠期间保持音量稳定；直线曲线则会在中间出现凹陷。',
    },
    fewer: '收起设置',
    more: '其他过渡',
    reset: '恢复默认',
    seconds: (written) => `${written} 秒`,
  },

  equalizer: {
    missing: '此版本的应用尚不支持均衡器。',
    title: '均衡器',
    attached: '正在调整当前播放的声音。',
    saved: '已保存，播放时立即生效。',
    carried:
      '手机自带均衡器的设置已迁移过来，并以“手机均衡器”的名称保存在“预设”中。它是用本均衡器的频段重建的同一条曲线，并且会为提升的部分预留余量，因此可能比原来稍微小声一些。',
    lost: '无法迁移手机自带均衡器的设置：其频段无法与具体频率对应。本均衡器从平直开始。',

    presets: '预设',
    saveAs: '另存为…',
    rename: '重命名…',
    confirmDelete: (name) => `删除“${name}”？`,
    importAutoEq: '导入 AutoEQ…',
    keptAs: (name) => `已保存为“${name}”。`,
    renamedTo: (name) => `已重命名为“${name}”。`,

    bands: '频段',
    noBands: '没有频段，即为平直：保持录音原貌。你可以添加频段、选择预设，或导入适合你耳机的校正。',
    addBand: '添加频段',
    full: (most) => `最多只能添加 ${most} 个频段。`,

    preamp: '前置增益',
    automatic: '自动',
    byHand: '手动设置',
    nothingBoosted: '没有提升任何频段，因此无需整体降低来预留余量。',
    turnedDown: (by) =>
      `整体降低了 ${by}，正好等于曲线最高点的提升量。这是提升时避免削波所需的余量。`,
    typeIt: (now) => `输入数值 · ${now}`,
    typePreamp: (now) => `输入前置增益，当前为 ${now}`,
    clipsAbove: (level) => `高于 ${level} 时，最响的段落可能会削波，听起来像是破音。`,
    lowEnough: '已足够低，这条曲线的任何提升都不会削波。',

    unbuilt:
      '此版本的应用仍通过手机自带的均衡器播放，而本页面已不再设置它。频段功能将在下一个版本中提供；下方的控件仍照常工作。',

    tone: '音色',
    bassBoost: '低音增强',
    surround: '环绕声',
    loudness: '响度',
    toneNote:
      '这三项是手机自带的音效，在频段之后生效。“响度”会提升安静的录音而不改变音色。调得过高会削波，听起来像是响亮的部分破音。',
    resetAll: '全部重置',

    prompt: {
      keepCurveAs: '将此曲线保存为',
      keepCorrectionAs: '将此校正保存为',
      namePlaceholder: '名称，例如对应的耳机型号',
      keep: '保存',
      aName: '名称',
      set: '设置',
      preampHint: (least, most) => `单位为分贝，范围 ${least} 到 ${most}。`,
      frequency: (band) => `频段 ${band} 的频率`,
      frequencyHint: (least, most) => `单位为赫兹，范围 ${least} 到 ${most}。1.2k 表示 1200。`,
      gain: (band) => `频段 ${band} 的增益`,
      gainHint: (most) => `单位为分贝，范围 -${most} 到 ${most}。`,
      q: (band) => `频段 ${band} 的 Q 值`,
      qHint: (least, most) => `范围 ${least} 到 ${most}。`,
    },
  },

  presets: {
    builtIn: {
      Flat: '平直',
      'More bass': '增强低音',
      'Less boom': '减少轰鸣',
      Warm: '温暖',
      'Voices forward': '突出人声',
      'More air': '增加空气感',
      'Quiet listening': '小音量聆听',
    },
    myCurve: '我的曲线',
  },

  band: {
    types: { peak: '峰值', lowShelf: '低架', highShelf: '高架' },
    said: (band, type, frequency, gain, q) => `频段 ${band}：${type}，${frequency}，${gain}，Q 值 ${q}`,
    closes: '收起此频段',
    opens: '展开此频段进行调整',
    kind: (band, type) => `频段 ${band} 类型：${type}`,
    frequency: '频率',
    gain: '增益',
    widthQ: '带宽（Q 值）',
    cornerQ: '拐角（Q 值）',
    peakHint: 'Q 值越高，频段越窄：1 约为一个多八度，10 约为一个音。',
    shelfHint: '架式滤波会整体提升或降低其频率一侧的所有声音。Q 值决定拐角的陡峭程度，通常为 0.7。',
    typeIt: '输入数值',
    typeFrequency: (band, now) => `输入频段 ${band} 的频率，当前为 ${now}`,
    typeGain: (band, now) => `输入频段 ${band} 的增益，当前为 ${now}`,
    typeQ: (band, now) => `输入频段 ${band} 的 Q 值，当前为 ${now}`,
    remove: (band) => `移除频段 ${band}`,
    removeThis: '移除此频段',
  },

  curve: {
    label: (said) => `频响曲线。${said}`,
    flat: '平直：没有提升或降低任何频率。',
    highest: (level, near) => `最高 ${level}，位于 ${near} 附近。`,
    lowest: (level, near) => `最低 ${level}，位于 ${near} 附近。`,
    highestAndLowest: (high, highNear, low, lowNear) =>
      `最高 ${high}，位于 ${highNear} 附近；最低 ${low}，位于 ${lowNear} 附近。`,
  },

  autoEq: {
    title: '从 AutoEQ 导入',
    about: '粘贴耳机的 ParametricEQ.txt 文件内容，或选择该文件。',
    textLabel: 'ParametricEQ 文件的文本内容',
    chooseFile: '选择文件…',

    graphic: '这是 GraphicEQ 文件，适用于另一种均衡器。请使用 ParametricEQ.txt。',
    noneSupported: '这段文本中的滤波器类型本均衡器都不支持。',
    noneFound: '这段文本中没有找到滤波器。每一行应类似于“Filter 1: ON PK Fc 105 Hz Gain -3.4 dB Q 0.70”。',
    imported: (count) => `已导入 ${count} 个频段。`,
    leftOut: (count, room) => `另有 ${count} 个未导入：最多只能容纳 ${room} 个。`,
    unsupported: (count) => `${count} 个滤波器的类型本均衡器不支持，已跳过。`,
    adjusted: (count) => `${count} 个超出了频段可设置的范围，已调整到范围内。`,
  },
};
