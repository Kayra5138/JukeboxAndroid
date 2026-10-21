import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const settings: Strings['settings'] = {
  lastBuilt: (when) => `构建时间：${when}`,
  lastBuiltUnknown: '构建时间：安装新版 APK 后显示',

  sections: {
    look: '外观',
    sound: '声音',
    player: '播放器',
    library: '音乐库',
    downloads: '下载与发现',
    data: '你的数据',
    views: '音乐库视图',
    experimental: '实验性功能',
  },
  categories: {
    look: '主题、专辑唱片架、动效，以及音乐库提供哪些视图。',
    sound: '均衡器和音效、音量均衡、交叉淡化，以及速度和音调。',
    player: '跳转按钮的步长、播放队列结束后播放什么，以及歌词翻译的目标语言。',
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
  heart: { title: '爱心', note: '在播放器上显示一颗爱心，但它不会记录任何东西。' },
  listButton: {
    title: '添加到歌单按钮',
    note:
      '播放器上的一个按钮，无需打开菜单即可把正在播放的歌曲加入你的歌单。',
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
  moreButton: {
    title: '每行的三点按钮',
    note:
      '显示在每首歌曲行的末尾，打开与长按相同的菜单。关闭后仍可长按打开。',
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
    note: '你的收听记录、歌单、标签、歌词和设置，保存为一个文件，位置由你选择。不包括音乐文件本身。',
    failed: '无法保存备份。',
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
