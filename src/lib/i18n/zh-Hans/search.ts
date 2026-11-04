import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const search: Strings['search'] = {
  modes: {
    discover: '发现',
    download: '下载',
    videos: '视频',
    playlists: '播放列表',
  },

  tapes: {
    intro:
      '来自 YouTube 的有声书、播客、讲座和长录音，会下载到音乐库的 Tapes 文件夹，并从你上次停下的地方继续播放。搜索，或粘贴视频或播放列表的链接；粘贴频道链接即可关注。',
    placeholder: { videos: '标题、节目或 YouTube 链接', playlist: '书、系列或播放列表链接' },
    empty: { videos: '搜索一本书、一档节目、一场演讲或一门课。', playlist: '搜索一个播放列表，作为一盘磁带下载：分章节的书，或某档节目的一季。' },
    download: '作为磁带下载',
    downloadBook: (count) => `将全部 ${format.number(count)} 个作为一盘磁带下载`,
    bookHint: '它们会按列表顺序编号，放进以列表命名的文件夹，并依次连续播放。',
    added: (name) => `正在下载到 Tapes/${name}`,
    sources: { youtube: 'YouTube', podcasts: '关注', books: '图书', files: '手机' },
    /** Books from the Internet Archive: see `books/archive.ts`, `BooksPane` and the book screen. */
    /** Files on the phone brought into the Tapes folder: see `FilesPane`. */
    files: {
      intro: '把手机里已有的图书、录音和讲座复制到磁带的一个文件夹中。所选文件仍保留在原处。',
      choose: '选择文件',
      chooseOther: '选择其他文件',
      folder: '文件夹名称',
      folderPlaceholder: '图书或录音的名称',
      folderNote: '将以此名称放入媒体库的磁带文件夹，按文件名中的编号排序。',
      copy: (count) => `将 ${format.number(count)} 个文件复制到磁带`,
      chosen: (count) => `已选择 ${format.number(count)} 个文件`,
      copied: (done, of) => done === of ? `已将 ${format.number(done)} 个文件复制到磁带。` : `已复制 ${format.number(of)} 个中的 ${format.number(done)} 个，其余无法读取。`,
      failed: '所有文件都无法复制。',
      pickFailed: '无法选择文件。',
      toTapes: '前往磁带',
    },
    books: {
      intro: '公有领域的图书，由 LibriVox 志愿者朗读，免费保存在 Internet Archive。可按书名或作者搜索，或粘贴 archive.org 上任何可收听内容的地址。',
      placeholder: '书名、作者或 archive.org 链接',
      nothingFound: '没有找到图书。',
      searchFailed: '无法搜索 Internet Archive。',
      anyLanguage: '所有语言',
      popular: '收听最多',
      bookFailed: '无法从 Internet Archive 读取这本书。',
      stats: (parts, minutes, here) => `${format.number(parts)} 个部分 · ${minutes >= 60 ? `${format.number(Math.floor(minutes / 60))} 小时 ${format.number(minutes % 60)} 分钟` : `${format.number(minutes)} 分钟`}${here > 0 ? ` · 手机上 ${format.number(here)} 个` : ''}`,
      fetchAll: '获取整本书',
      fetchRest: (count) => `获取其余 ${format.number(count)} 个部分`,
      size: (mb) => `总计约 ${format.number(mb)} MB`,
      parts: (count) => `${format.number(count)} 个部分`,
    },
    podcasts: {
      intro: '关注播客或 YouTube 频道，新单集会自动来到你的磁带；也可以打开后只获取想听的单集。可以搜索，或粘贴订阅源或频道的地址。',
      /** Under the button on a show not followed: that its episodes can be had without following it. */
      withoutFollowing: '收听无需关注：在下方获取任意单集。关注后，新单集会自动到来。',
      /** Where podcasts can be had from: said under the intro. */
      /** The title of a followed or followable show's own screen, a podcast or a YouTube channel. */
      showTitle: '节目',
      sources: '来源：Apple 播客目录中的任何节目（几乎收录所有有公开订阅源的播客，包括 Spotify 上的大多数）、Anchor、Buzzsprout、Libsyn、Podbean、SoundCloud 等任意订阅源地址，以及 YouTube 频道。',
      placeholder: '播客或频道名称，或链接',
      searchFailed: '无法搜索播客。请检查网络连接。',
      feedFailed: '无法读取这个播客的订阅源。',
      notChannel: '这不是 YouTube 频道的地址，或找不到该频道。',
      channelsHeading: 'YouTube 频道',
      podcastsHeading: '播客',
      subscribers: (count) => `${format.number(count)} 位订阅者`,
      channelsFailed: '无法在 YouTube 上搜索频道。',
      nothingFound: '未找到播客。',
      yours: '你的播客',
      noneYet: '你还没有关注任何播客。',
      wifiOnly: '新单集仅在 Wi‑Fi 下下载',
      wifiOnlyNote: '你关注的播客的单集只会在 Wi‑Fi 下自动下载。你仍然可以手动下载任意单集。',
      follow: '关注',
      following: '已关注',
      unfollow: '取消关注',
      autoDownload: '获取最新单集',
      autoDownloadNote: (keep) => `保留最新的 ${format.number(keep)} 集已下载。`,
      keep: (count) => format.number(count),
      episodes: (count) => `单集 · ${format.number(count)}`,
      noEpisodes: '这个订阅源里没有带文件的单集。',
      download: '下载',
      continue: '继续播放',
      start: '开始播放',
      more: '更多',
      less: '收起',
      stats: (total, here) => `${format.number(total)} 集 · 手机上有 ${format.number(here)} 集`,
      play: '播放',
      /** The episodes shown by when they came out: see `podcasts/when.ts`. */
      when: { label: '时间', all: '全部', week: '过去一周', month: '过去一个月', quarter: '过去三个月' },
      newest: '最新在前',
      oldest: '最早在前',
      noneThen: '这段时间没有单集。',
      fetchNext: '获取后续单集',
      fetchNextNote: (count) => `收听较早的单集时，会获取它之后的 ${format.number(count)} 集，每集播完时下一集都已就绪。`,
      line: (date, length) => [date, length].filter(Boolean).join(' · '),
    },
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
  backToResults: '返回结果',
  openPlaylistLabel: (title) => `打开播放列表“${title}”`,
  downloadLabel: (title) => `下载“${title}”`,
  download: { mp3: '下载 MP3', original: '下载音频' },
  adding: '正在添加…',
  listen: '收听',
  listenLabel: (title) => `收听 ${title} 而不保存`,
  readying: '正在准备…',
  listenDrop: '不保存',

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
    listened: '可播放，未保存',
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
