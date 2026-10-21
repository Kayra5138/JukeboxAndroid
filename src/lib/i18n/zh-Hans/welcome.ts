import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const welcome: Strings['welcome'] = {
  language: {
    heading: '选择语言',
    note: '之后可以随时在“设置”中更改。',
    go: '继续',
    made:
      'Jukebox 由一个人独立开发。除英语外，其他语言均由 AI 翻译，尚未经过母语者检查。如果发现表达不对，欢迎在 GitHub 上反馈。',
  },

  setup: {
    step: (at: number, of: number) =>
      `第 ${format.number(at)} 步，共 ${format.number(of)} 步`,
    skip: '跳过',
    skipHint: '其余保持不变，直接打开 Jukebox',
    back: '上一步',
    next: '继续',
    done: '完成',
    update:
      '这个版本新增了几项设置。之后可以随时在“设置”中更改。',
    look: {
      heading: '选择外观',
      note: '点一下即可试用。',
      more:
        '更多主题，以及跟随系统时使用哪两个主题，可以在“设置 → 外观”中选择。',
    },
    discover: {
      heading: '发现',
      note:
        '“发现”会从你音乐库里的艺人及相似艺人中，找出你还没有的歌曲，并在播放时从 YouTube 获取。',
      more:
        '列表长度、刷新频率等更多选项在“发现设置”中。',
    },
  },

  offer: {
    heading: '查找封面和歌曲信息？',
    body: (count) =>
      `你有 ${format.number(count)} 首歌曲尚未在线查询。Jukebox 可以在 MusicBrainz 和 Apple 的 iTunes 目录中查找它们的封面、艺人和专辑。`,
    privacy:
      '只会向这两个服务发送歌曲名称，不发送其他任何内容。查询会在你听歌时于后台进行，也可以稍后在“设置 → 音乐库 → 标签”中进行。',
    accept: '开始查找',
    decline: '以后再说',
  },

  progress: {
    starting: '正在查找封面和歌曲信息…',
    counting: (done, total) =>
      `正在查找封面和歌曲信息 · ${format.number(done)} / ${format.number(total)}`,
    album: (album, done, total) =>
      `正在查询“${album}” · ${format.number(done)} / ${format.number(total)}`,
    covers: (done, total) =>
      `正在查找封面 · ${format.number(done)} / ${format.number(total)}`,
    lyrics: (done, total) =>
      `正在查找歌词 · ${format.number(done)} / ${format.number(total)}`,
    hint: '打开“标签”页面，可在其中查看进度或停止查询',
  },

  tips: {
    library:
      '长按歌曲可打开菜单：添加到歌单、编辑信息，或玩钢琴块。向右滑动歌曲可设为下一首播放，向左滑动可添加到播放队列。',
    player:
      '控制按钮下方的歌词按钮会随播放显示歌词；歌词显示后，旁边出现的按钮可以翻译歌词。齿轮里有速度和音调、音效以及睡眠定时。',
    discover:
      '“发现”会为你找到你还没有的歌曲。在你听得足够多之前，它会从你歌曲最多的艺人入手，并根据你的收听不断学习。',
    dismiss: '知道了',
    dismissHint: '不再显示此提示',
  },

  settings: {
    title: '首次启动',
    note:
      '重新显示刚安装时看到的内容：最初的设置、是否查找封面的询问，以及使用提示。你的音乐、歌单和设置不会改变。',
    again: '重新查看',
  },

  discoverEarly: '你听得还不多时，“发现”会从你歌曲最多的艺人入手，并根据你的收听不断学习。',
};
