import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const search: Strings['search'] = {
  modes: {
    discover: '发现',
    download: '下载',
    videos: '视频',
    playlists: '播放列表',
  },

  unavailable: {
    heading: '需要新版应用才能使用 YouTube',
    body: '请安装新版应用以搜索和下载音乐。你的音乐库仍可正常使用。',
    downloads: '请安装新版应用以启用 YouTube 下载。',
  },

  intro: {
    videos: '搜索 YouTube 或粘贴视频链接，将音频保存到你的音乐库。',
    playlist: '搜索播放列表或粘贴其 YouTube 链接。打开结果即可预览并下载其中的歌曲。最多检查播放列表的前 500 项。',
  },
  inputLabel: {
    videos: '搜索 YouTube 或粘贴视频链接',
    playlist: '播放列表名称或 YouTube 链接',
  },
  placeholder: {
    videos: '歌曲、艺人或 YouTube 链接',
    playlist: '播放列表名称或 YouTube 链接',
  },

  formats: { mp3: 'MP3', original: '原始音频' },
  formatHint: {
    mp3: '下载后转换为 MP3。',
    original: '尽可能保留源音频编码。',
  },

  searching: '正在搜索 YouTube…',
  results: (count) => `结果 · ${format.number(count)}`,
  empty: {
    none: '未找到结果。请换个关键词或链接试试。',
    videos: '按歌名和艺人搜索，找到你想要的录音。',
    playlist: '按播放列表名称搜索，或粘贴播放列表链接。',
  },

  playlist: '播放列表',
  openPlaylist: '打开播放列表',
  openPlaylistLabel: (title) => `打开播放列表“${title}”`,
  downloadLabel: (title) => `下载“${title}”`,
  download: { mp3: '下载 MP3', original: '下载音频' },
  adding: '正在添加…',

  addingPlaylist: '正在添加播放列表…',
  downloadListed: {
    mp3: '下载列表中的歌曲 · MP3',
    original: '下载列表中的歌曲 · 原始音频',
  },
  listedHint: '已下载或已在队列中的歌曲会被跳过。私享、已删除和直播视频可能无法获取。',
  listCreated: (name) => `已创建歌单“${name}”。下载完成的歌曲会出现在“歌单”中。`,
  inLibrary: '已在音乐库中',
  alreadyHave: (count) => `有 ${format.number(count)} 首歌曲已在音乐库中，未重复下载。`,
  unnamedPlaylist: 'YouTube 播放列表',

  jobLine: (status, mp3) => `${status} · ${mp3 ? 'MP3' : '原始音频'}`,

  status: {
    finding: '正在 YouTube 上查找',
    queued: '排队中',
    preparing: '正在准备…',
    downloading: (percent) => `正在下载 · ${percent}%`,
    converting: '正在转换音频…',
    saving: '正在添加到音乐库…',
    cancelling: '正在取消…',
    cancelled: '已取消',
    failed: '下载失败',
    done: '已在音乐库中',
    missing: '文件已删除',
  },

  failed: {
    search: '搜索失败，请重试。',
    queue: '无法加入下载队列。',
    queuePlaylist: '无法将播放列表加入队列。',
    cancel: '无法取消下载。',
    read: '无法读取下载内容。',
    readReopen: '无法读取下载内容。请重新打开“搜索”。',
  },

  errors: {
    playlistLink: '请粘贴 YouTube 播放列表链接，或按播放列表名称搜索。',
    videoLink: '请输入歌名或有效的 YouTube 视频链接。',
    queueFull: '下载队列已满。请等一些歌曲下载完成后再试。',
    update: 'YouTube 已有变动，此版本的下载器暂时无法读取。请在“下载”中检查新版本，或更新 Jukebox。',
    unavailable: '该视频或播放列表无法获取。请试试其他公开播放列表或重新搜索。',
    unreachable: '无法连接 YouTube。请检查网络连接后重试。',
    refused: 'YouTube 无法完成此请求。请稍后重试或选择其他结果。',
  },
};
