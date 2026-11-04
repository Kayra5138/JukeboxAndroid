import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const settings: Strings['settings'] = {
  lastBuilt: (when) => `构建时间：${when}`,
  lastBuiltUnknown: '构建时间：安装新版 APK 后显示',

  sections: {
    look: '外观与触感',
    sound: '声音',
    player: '播放器',
    tapes: '磁带',
    library: '音乐库',
    downloads: '下载与发现',
    data: '你的数据',
    views: '音乐库视图',
    experimental: '实验性功能',
  },
  categories: {
    look: '主题、专辑唱片架、动效、振动，以及音乐库提供哪些视图。',
    sound: '均衡器和音效、音量均衡、交叉淡化，以及速度和音调。',
    player: '跳转按钮的步长、播放队列结束后播放什么，以及歌词翻译的目标语言。',
    tapes: '智能回退、磁带跳转按钮的步长，以及仅在 Wi‑Fi 下获取播客。',
    library: '音乐所在的文件夹、标签和封面，以及可能是同一首歌的文件。',
    waiting: (count) => `${format.number(count)} 项待确认`,
    downloads: '下载队列及其悬浮按钮、“发现”，以及保持 YouTube 下载器为最新版本。',
    data: '备份全部内容或导入备份、检查新版本，以及 ListenBrainz（实验性）。',
  },

  language: {
    title: '语言',
    note: '应用使用的语言，不跟随手机的系统语言。',
  },
  theme: {
    title: '主题',
    open: '多种配色、玻璃效果，或自己调配一款。',
    note: '“跟随系统”会按照手机的浅色或深色模式切换。',
    pair: {
      light: '浅色模式下',
      dark: '深色模式下',
      note: '“跟随系统”在这两个主题之间切换，与手机保持一致。',
    },
    shuffle: {
      title: '每次换个主题',
      on: '开启',
      toggle: '每次打开应用时随机选择一个主题',
      note: '勾选要参与随机的主题。选中的主题会一直使用到下次打开应用，期间你仍可以手动更换。',
      empty: '至少勾选一个主题，此功能才会生效。',
    },
  },
  customTheme: {
    open: '自定义主题颜色',
    openNote: '为自定义主题选择背景色和强调色，其余颜色会据此自动生成。',
    preview: '预览',
    background: '背景',
    accent: '强调色',
    surface: '卡片',
    automatic: '自动',
    automaticNote: '根据背景色自动生成',
    presets: '推荐颜色',
    hue: '色相',
    saturation: '饱和度',
    lightness: '亮度',
    degrees: (value) => `${value}°`,
    percent: (value) => `${value}%`,
    hex: '颜色代码',
    nudged: (colour) => `已调整为 ${colour}，以便上面的内容清晰可读。`,
    note: '文字颜色会根据这些颜色自动计算，确保始终清晰可读。出于同样的原因，你选择的颜色可能会被稍微调亮或调暗。',
    use: '使用此主题',
    reset: '重置',
    sample: {
      title: '歌曲名称',
      line: '艺人 · 专辑',
      chip: '随机播放',
      button: '播放',
    },
  },

  tags: { note: '歌曲信息和专辑封面' },
  rack: {
    title: '专辑唱片架',
    note: '横握手机时，像翻唱片一样浏览专辑封面，而不是看列表。点按最前面的一张即可打开。',
  },
  favoritesShown: { title: "收藏", note: "一个始终存在的列表，最新的在最上面，由播放器上的爱心和歌曲菜单中的“加入收藏”填充。关闭后三者都会隐藏，内容保留。" },
  listButton: {
    title: '添加到歌单按钮',
    note:
      '播放器上的一个按钮，无需打开菜单即可把正在播放的歌曲加入你的歌单。',
  },
  autoplaySizes: { title: '每次添加的相似歌曲', library: '来自曲库', fresh: '来自 Discover 的新歌', note: '每次补充队列时添加多少首，适用于“用相似歌曲继续播放”和与相似歌曲一起播放的歌曲。每首新歌都需要下载。混合模式各取四分之三。' },
  tap: {
    title: '点击歌曲时',
    note: '在 Tracks 或搜索结果中点击一首歌后接着播放什么。',
    sheetNote: '专辑或歌单上方的 Play 和 Shuffle、Shuffle all 以及 Discover 不受影响。每首歌的菜单里还有一次性的“播放并接相似歌曲”和“只播放这首”。',
    list: { label: '列表的其余部分', note: '之后的歌曲，按显示顺序。' },
    shuffled: { label: '列表的其余部分，随机', note: '先播这首，然后列表中其他歌曲随机播放。' },
    similar: { label: '相似歌曲', note: '先播这首，然后从你选择的来源（曲库或 Discover）加入一批相似歌曲。之后队列按“用相似歌曲继续播放”的设置继续。' },
    only: { label: '只播这首', note: '之后不播放，除非“用相似歌曲继续播放”加入歌曲。' },
    source: { title: '相似歌曲来源', note: '点击的歌曲之后最先播放的歌曲从哪里来。之后由“用相似歌曲继续播放”接管。' },
    everywhere: { title: '专辑和歌单中也适用', note: '在专辑、歌单、艺人或文件夹页面点击歌曲时也适用。关闭时，它们按自身顺序播放。' },
  },
  autoplay: {
    title: '用相似歌曲继续播放',
    note: '播放队列快结束时，会在末尾添加与你正在听的歌曲相似的歌曲。',
    sheetNote: '会在结束前几首就添加，因此即使锁屏，也会像播放队列中的其他歌曲一样接着播放。开启循环播放时不会添加。',
    off: {
      label: '关闭',
      note: '不添加任何歌曲，播放队列结束时音乐停止。',
    },
    library: {
      label: '来自音乐库',
      note: '根据标签、艺人以及你常一起听的歌曲挑选。无需联网。',
    },
    fresh: {
      label: '新歌',
      note: '由“发现”找到你还没有的歌曲。与“发现”一样使用网络并从 YouTube 下载，并遵循它的 Wi-Fi 设置。',
    },
    mixed: {
      label: '混合',
      note: '先播放两首音乐库中的歌曲，再播放一首新歌。新歌与“发现”一样使用网络并从 YouTube 下载，并遵循它的 Wi-Fi 设置。',
    },
  },
  downloads: {
    listen: { title: '收听过但未保存的歌曲', note: '除非你保存（点心、加入列表或从菜单保存），下载后这么多天会被删除。', days: (days) => `${format.number(days)} 天`  },
    note: '正在下载、等待中和已完成的内容。',
    button: {
      title: '下载悬浮按钮',
      note: '有内容正在下载时及之后几分钟内，应用上方会显示一个圆形按钮。点按即可查看进度。',
    },
    check: {
      title: '检查 YouTube 下载器更新',
      note: '每天最多一次，且仅在你打开“下载”页面或开始下载时，Jukebox 会向 GitHub 查询 yt-dlp 的最新版本。不会发送任何关于你或你的音乐库的信息，未经你同意也不会下载任何内容。',
    },
  },
  discover: { note: '列表的长度、多久重新生成一次，以及已排除的内容。' },
  still: {
    title: '减少装饰动效',
    note: '适合容易掉帧的手机。播放器会直接出现而不是向上滑出，游戏中获得或失去生命时也不再闪光。琴键仍会落下——那是游戏本身，不是装饰。',
  },
  scriptNames: { title: '其他文字的名称', latin: '拉丁字母', original: '原文', note: '当查找同时找到歌曲的拉丁字母名和原文名（日文、中文、韩文）时，曲库显示哪一个。之前查找过的歌曲在重新查找后补全。' },
  haptics: {
    title: "振动",
    open: "手指触碰时应用振动的多少与强弱。",
    mode: "振动",
    modes: { off: "关闭", essential: "仅重要", all: "全部", custom: "自定义" },
    modeNotes: {
      off: "应用完全不振动。",
      essential: "只在最有意义的时候：长按生效、操作成功与否，以及游戏。",
      all: "长按和拖动、开关和选项、滑块刻度、结果、播放器按钮和游戏。",
      custom: "在下方选择哪些时刻振动。",
    },
    strength: "强度",
    strengthNote: "松手时可感受到。电机无法调节强弱的手机保持其自身强度。",
    groupsHeading: "哪些会振动",
    groups: {
      holds: { title: "长按和拖动", note: "长按生效、抬起一行以移动、手指划过复选框。" },
      choices: { title: "开关和选项", note: "开关、选项的标签、选中的选项。" },
      notches: { title: "刻度和步进", note: "正常速度、0 dB、滑块中点、图表的列。" },
      results: { title: "结果", note: "操作成功或失败：找到、写入、添加、导入。" },
      player: { title: "播放器按钮", note: "播放、跳过、重复、爱心、点按歌词的一行。" },
      fun: { title: "游戏和乐趣", note: "Piano Tiles 的按键等。" },
    },
    phone: "如果手机设置中关闭了触摸反馈，应用也不会振动。",
  },
  moreButton: {
    title: '每行的三点按钮',
    note:
      '显示在每首歌曲和每张专辑行的末尾，打开与长按相同的菜单。关闭后仍可长按打开。',
  },
  tabs: {
    title: '标签页',
    searchNote: '“发现”和 YouTube 下载都在这个标签页中，会随之隐藏。',
    aside: '音乐库和设置始终显示。',
  },

  views: {
    notes: {
      tracks: '所有歌曲，每行一首。',
      albums: '根据标签信息整理成的专辑。',
      artists: '歌曲署名的所有艺人。两位艺人合作的歌曲在两人名下都会出现。',
      folders: '音乐库文件夹下存放文件的各个文件夹。',
      tapes: '音乐库文件夹中“Tapes”文件夹里的有声书、播客和长录音，会从你上次停下的地方继续播放。',
    },
    onlyHint: '这是唯一开启的视图，因此保持开启',
    toggleHint: '在音乐库中显示或隐藏此视图',
    asideOne: '只开启一个视图时，音乐库直接显示它，不显示切换按钮。至少会保留一个视图。',
    asideMany: '音乐库的切换按钮中只列出已开启的视图。至少会保留一个视图。',
  },

  sameSong: {
    note: (count) =>
      `${format.number(count)} 个文件看起来与你已有的另一个文件是同一首歌。在你做出决定之前，它们的播放记录会分开保存。`,
  },
  exportAll: {
    title: '导出全部内容',
    note: '你的收听记录、歌单、标签、歌词和设置、关注的播客，以及每盘磁带听到的位置和做的标记，保存为一个文件，位置由你选择。不包括音乐文件本身。',
    failed: '无法保存备份。',
  },
  autoBackup: {
    title: '自动备份',
    off: '与“导出全部内容”相同的文件，每天或每周自动保存到你选择的文件夹。',
    folder: '文件夹',
    folderUnnamed: '已选文件夹',
    chooseOther: '选择其他文件夹',
    lost: 'Jukebox 无法再访问此文件夹：它可能已被移动或删除，或权限已被收回。请重新选择文件夹以继续备份。',
    chooseAgain: '重新选择文件夹',
    every: '频率',
    daily: '每天',
    weekly: '每周',
    keep: '保留份数',
    keepNote: (count) => `文件夹中保留最新的 ${format.number(count)} 份备份，更早的会被删除。文件夹中的其他文件不会被改动。`,
    last: (when) => `上次备份：${when}`,
    never: '尚未备份。',
    failed: '上次备份未能完成，下次会再试。',
    now: '立即备份',
    made: '已备份。',
  },
  importBackup: {
    title: '导入',
    note: '导入一份备份。在做出任何更改之前，会先向你展示其中的内容并征得你的同意。',
    failed: '导入失败。',
    refused: (reason) => `${reason}这台手机上的内容没有任何更改。`,
  },

  playback: {
    title: '播放',
    note: (speed) => `速度和音调 · ${speed}×`,
  },
  equalizer: { note: '频段、低音、环绕声和响度' },
  effects: { note: '宽度、交叉馈送、旋转和电平' },
  /** The tape settings, apart from the music's: see `app/settings-tapes.tsx`. */
  tapes: {
    smartRewind: {
      title: '智能回退',
      note: '隔一段时间再播放的磁带，会从停下的位置稍早一点开始，离开越久退得越多：短暂停顿后退 3 秒，隔一天退半分钟。关闭后从停下的位置原样继续。',
    },
    skipSilence: { title: '跳过静音', note: '跳过说话中的停顿，磁带会短一些。不影响音乐。' },
    voiceClarity: { title: '更清晰的人声', note: '在你的均衡器之上，压低人声下的低频嗡声，并稍微提升分辨字词的频段。仅在播放磁带时。' },
    skipSponsors: { title: '跳过赞助', note: '来自 YouTube 的磁带中，SponsorBlock 用户标记的部分（赞助信息、频道自我推广、订阅提醒）会被跳过。' },
    back: '后退',
    forward: '前进',
    jumpNote: '播放磁带时，播放键两侧按钮跳转的秒数。音乐的步长在“播放器”中单独设置。',
    podcasts: '播客',
    deletePlayed: {
      title: '删除已听单集',
      off: '已关注播客的单集听完后仍保留在手机上。',
      after: (days) => `已关注播客的单集若由应用获取，在完整听完 ${format.number(days)} 天后删除。做过标记的会保留。`,
    },
    /** The podcasts followed, as an OPML file: see `podcasts/opml.ts`. */
    opml: {
      heading: '迁移播客',
      export: '保存已关注的播客',
      exportNote: '保存为其他播客应用也能读取的 OPML 文件。',
      import: '从文件关注播客',
      importNote: '来自其他播客应用的 OPML 文件。节目会被关注，但不会自动获取任何内容；可在每个节目的页面中开启。',
      importing: (done, total) => `正在读取第 ${format.number(done)} 个，共 ${format.number(total)} 个…`,
      imported: (followed, already, failed) => [`已关注 ${format.number(followed)} 个播客。`, already > 0 ? `${format.number(already)} 个已在关注中。` : '', failed > 0 ? `${format.number(failed)} 个无法读取。` : ''].filter(Boolean).join(''),
      nothing: '该文件中没有播客。',
      failed: '无法读取或写入该文件。',
      none: '你还没有关注任何播客。',
      saved: (count) => `已保存 ${format.number(count)} 个播客。`,
    },
  },
  jump: {
    title: '跳转步长',
    note: '播放键两侧的两个按钮每次在歌曲中前进或后退的秒数。',
  },
  crossfade: { note: '一首歌如何过渡到下一首' },
  loudness: {
    title: '音量均衡',
    note: '提高安静歌曲的音量，降低响亮歌曲的音量。按顺序播放的专辑会保留其自身的强弱起伏。',
  },
  lyricsLanguage: {
    title: '歌词翻译为',
    note: '歌词在手机上本地翻译。除英语外的其他语言都需经由英语中转，首次使用时还会下载第二个模型。',
  },
};
