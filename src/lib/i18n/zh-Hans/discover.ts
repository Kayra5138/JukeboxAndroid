import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const discover: Strings['discover'] = {
  panel: {
    heading: '为你发现的新歌',
    refresh: '刷新',
    updated: (date) => `更新于 ${date}`,

    familiar: (because) => `你常听艺人的更多作品 · ${because}`,
    fresh: (because) => `新艺人 · ${because}`,
  },

  header: {
    notYet: '还没有列表',
    about: '关于“发现”',
    settings: '发现设置',
    findMore: '查找更多',
    dismiss: '关闭',
  },

  about: {
    heading: '关于“发现”',
    what: '根据你过去 30 天的收听，挑选你还没有的歌曲：你常听艺人的更多作品，以及与他们相近的艺人。',
    source:
      '你的收听记录只在这台手机上读取。推荐来自 ListenBrainz 和 MusicBrainz，歌曲要播放时才会从 YouTube 获取音频。',
    keep: '“保留”会将歌曲加入你的音乐库，并从列表中移除，因为你已经找到了它。',
    exclude: '“不要这首”会将歌曲从列表中移除，以后也不再推荐。在菜单中还可以对它的艺人这样做。',
    room: '无论哪种操作，都会有另一首歌补上空位。向侧边滑动某一行也能执行同样的操作，长按可查看更多选项。',
  },

  row: {
    keep: '保留到音乐库',
    exclude: '不要这首',
    swipeKeep: '保留',
    swipeExclude: '不要',
    willPlay: '准备好后播放',
    preview: '试听中 · 完整歌曲即将就绪',
    previewStop: '停止试听。完整歌曲准备好后仍会播放',
    willKeep: '准备好后保存到音乐库',
    keeping: '正在保存到音乐库…',
    failed: '无法下载 · 点按重试',
    needsBuild: '需要新版应用',
    waitingWifi: '等待 Wi-Fi · 点按立即下载',
    percent: (percent) => `${format.number(percent)}%`,
    gettingReady: '正在下载',
    hint: '播放这首歌，如有需要会先下载',
    nowPlaying: (title) => `正在播放“${title}”`,
    menu: '歌曲选项',
  },

  menu: {
    play: { label: '播放', hint: '如有需要会先下载' },
    keep: { label: '保留到音乐库', hint: '归你所有，并从列表中移除' },
    exclude: { label: '不要这首', hint: '从列表中移除，以后不再推荐' },
    neverArtist: {
      label: (artist) => `不再推荐 ${artist}`,
      hint: '以后不再推荐这位艺人的任何歌曲',
    },
    why: '推荐理由',
    seeds: (artists) => `因为你听过 ${artists}`,
    tags: (tags) => `标签：${tags}`,
    freshArtist: '你的音乐库中没有的新艺人',
  },

  empty: {
    building: '正在为你生成列表…',
    none: '还没有列表。点按“刷新”，“发现”就会根据你的收听生成一份。',
    findingMore: '正在查找更多歌曲…',
    short: (missing) => `还有 ${format.number(missing)} 个空位。`,
  },

  player: {
    kept: '已保存到音乐库',
  },

  preview: {
    label: '试听',
    note: '完整歌曲准备好后会自动开始',
    stop: '停止试听',
  },

  settings: {
    heading: '发现',
    title: '发现设置',
    count: '推荐歌曲数量',
    countNote: '熟悉的艺人和新艺人各占一半。已保存和已排除的歌曲会立即被替换。',
    refresh: '刷新列表',
    everyDays: (days) => `${format.number(days)} 天`,
    manual: '手动',
    refreshNote:
      '后台任务何时运行由 Android 决定。如果刷新已经过期，重新打开 Jukebox 时也会运行。未保存的推荐会被替换；已加入队列的歌曲会保留到不再需要播放为止。',
    ready: '提前准备接下来的歌曲',
    readyNone: '不准备',
    readyNote:
      '提前下载，点按即可立即播放：列表最前面的歌曲，或正在播放的歌曲之后的几首。选择“不准备”时，歌曲会在你点按时才下载。',
    wifi: '仅在 Wi-Fi 下提前准备',
    wifiNote: '仅使用不计流量的 Wi-Fi。你点按的歌曲会使用当前任何可用网络下载。',
    preview: '下载时播放试听片段',
    previewNote:
      '点按尚未准备好的歌曲时，会立即播放来自 Deezer 的 30 秒试听片段，完整歌曲下载完成后从头开始播放。试听不计入收听记录。',
    nextList: '当前列表保持不变，下一份列表将按此设置挑选。',
    excluded: '已排除的歌曲',
    noneExcluded: '没有已排除的歌曲。',
    allowAgain: '恢复推荐',
    allowAgainLabel: (title) => `恢复推荐“${title}”`,
    unblock: '取消屏蔽',
    unblockLabel: (artist) => `取消屏蔽 ${artist}`,
    failed: '无法更新发现设置，请重试。',
  },

  state: {
    idle: '点按下载并播放',
    starting: '正在开始…',
    waitingFind: '等待查找',
    waitingDownload: '等待下载',
    waitingRetry: '稍后重试',
    finding: '正在查找录音…',
    preparing: '正在开始下载…',
    downloading: (percent) => `正在下载 · ${format.number(percent)}%`,
    converting: '即将完成…',
    saving: '马上就好…',
    ready: '可以播放',
    playing: '正在播放',
    willPlay: (doing) => `${doing} · 准备好后播放`,
    preview: (doing) => `正在试听 · ${doing}`,
    willKeep: (doing) => `${doing} · 准备好后保存到音乐库`,
    keeping: '正在保存到音乐库…',
    waitingWifi: '等待 Wi-Fi · 点按立即下载',
  },

  failure: {
    generic: '此下载未能完成。',
    fileMissing: '文件已不在手机上。',
    noRecording: '找不到这首歌的任何录音。',
    notASong: '找到的视频是直播，或时长远超这首歌。',
    stopped: '下载已停止。',
    needsBuild: '请安装新版 APK 以下载“发现”中的歌曲。',
    retry: (reason) => `${reason}点按重试。`,
  },

  status: {
    building: '正在查找歌曲…',
    filling: (known, total) => `正在查找歌曲 · ${format.number(known)} / ${format.number(total)}`,
    findingOffline: '没有网络连接。连接后会继续查找列表的其余部分。',
    findingPaused: '下载已暂停。恢复下载后会继续查找列表的其余部分。',
    findingLater: '部分歌曲暂时无法确认，“发现”稍后会再试。',
    buildingArtists: (done, total) =>
      `正在查找歌曲 · ${format.number(done)} / ${format.number(total)} 位艺人`,
    preparing: (ready, target) =>
      `新列表正在准备中 · ${format.number(target)} 首中已有 ${format.number(ready)} 首就绪。${ready > 0 ? '再次刷新即可立即查看。' : ''}`,
    offline: '没有网络连接。你的列表会保留，连接后会查找新歌曲。',
    offlineEmpty: '没有网络连接。连接后“发现”会为你生成列表。',
    noLibrary: '“发现”需要从这台手机上的音乐出发，但目前还没有找到任何音乐。',
    noTaste: '你的歌曲都没有艺人信息，“发现”无从入手。请在“设置 → 音乐库 → 标签”中查找歌曲信息。',
    unreachable: '无法获取推荐。你的列表会保留，请稍后重试。',
    unreachableEmpty: '无法获取推荐，请稍后重试。',
    exhausted: '目前还没有足够的新歌曲。你的列表保持不变。',
    exhaustedEmpty: '暂时没有可推荐的新内容。再多听一些，然后重试。',
    timedOut: '查找歌曲耗时过长，已停止。请重试。',
    throttled: '“发现”刚刚查找过。请一分钟后再试。',
    failed: '“发现”未能完成，请重试。',
    waitingWifi: '连接 Wi-Fi 后会下载接下来的歌曲。点按某首歌可立即下载。',
    waitingConnection: '有网络连接时会下载接下来的歌曲。',
    paused: '下载已暂停。恢复下载才能获取歌曲。',
  },

  notice: {
    kept: (title) => `“${title}”已保存到音乐库。`,
    excluded: (title) => `以后不再推荐“${title}”。`,
    excludedArtist: (artist) => `以后不再推荐 ${artist}。`,
    restored: (title) => `“${title}”已回到列表中。`,
    refreshed: '这是你的新列表。',
    keepFailed: (title) => `无法将“${title}”保存到音乐库，请重试。`,
    wrongFile: (title) => `“${title}”下载的文件是另一首歌曲。正在查找正确的歌曲，找到后保存。`,
    undo: '撤销',
  },

  engine: {
    needsTaste: '“发现”没有可作为起点的艺人或标签。',
    nothingFetched: '无法获取任何推荐。当前的“发现”列表会保留，请稍后重试。',
  },

  taste: {
    popularity: '歌曲热度',
    popularityKnown: '热门',
    popularityAny: '不限',
    popularityDeep: '小众',
    popularityNote:
      '决定“发现”是偏向知名艺人及其最热门的歌曲，还是偏向较少人发现的艺人和歌曲。选择“不限”时，新艺人会以其最知名的歌曲之一来介绍。',

    neverArtistLabel: (artist) => `不再推荐 ${artist}`,
    blockedArtists: '已屏蔽的艺人',
    noneBlockedArtists: '没有已屏蔽的艺人。',
    blockedArtistsNote: '排除一首歌也会降低推荐其艺人的可能。同一位艺人有三首歌被排除后，“发现”会在六个月内不再推荐这位艺人。',
  },

  why: {
    moreFrom: (artist) => `${artist} 的更多作品`,
    becauseYouPlay: (artists) => `因为你常听 ${artists}`,
    both: (first, second) => `${first} 和 ${second}`,
    like: (artist) => `类似 ${artist}`,
    withGenre: (line, genre) => `${line} · ${genre}`,
    fromTags: (tags) => `来自你常听的 ${tags}`,
    unexplained: '为你精选',
    veryNear: '与你常听的非常接近',
    near: '与你常听的接近',
    farther: '稍微拓展一些',
  },

  gathering: {
    around: (artist, done, total) =>
      `正在围绕 ${artist} 探索 · ${format.number(done)} / ${format.number(total)} 位艺人`,
    artists: (done, total) => `${format.number(done)} / ${format.number(total)} 位艺人`,
    naming: '正在识别这些歌曲…',
    offline: '没有网络连接。连接后“发现”会查找新歌曲。',
    throttled: '推荐服务要求“发现”降低频率。请几分钟后重试。',
    nothing: '这次没有找到新内容。当前的“发现”列表会保留，请稍后重试。',
  },
};
