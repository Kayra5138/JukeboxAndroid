import { common } from './common.ts';
import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const library: Strings['library'] = {
  views: {
    tracks: '歌曲',
    albums: '专辑',
    artists: '艺人',
    folders: '文件夹',
  },

  nothingMatches: (query) => `没有与“${query}”匹配的结果。`,
  noAlbums: '还没有专辑。歌曲经过在线查询后，专辑才会出现——文件所在的文件夹并不算专辑。',
  back: '‹ 返回',
  trackMenu: '歌曲选项',
  albumMenu: '专辑选项',

  screen: {
    viewSwitch: '音乐库视图',
    searchHints: {
      tracks: '搜索歌名、艺人和标签',
      albums: '搜索专辑名、艺人和标签',
      artists: '搜索艺人',
      folders: '搜索文件夹',
    },
    sort: '排序',
    sortShort: { name: '名称', added: '最新', played: '最近' },
    sortedBy: {
      name: '按名称排序',
      added: '按添加时间排序',
      played: '按最近播放时间排序',
    },
    sortHint: '更改音乐库的排列顺序',
    groupSortShort: { name: '名称', tracks: '歌曲数', played: '播放量', added: '最新' },
    groupSortedBy: {
      name: '按名称排序',
      tracks: '按歌曲数量排序',
      played: '按收听量排序',
      added: '按最近添加排序',
    },

    selectTracks: '选择歌曲',
    stopSelecting: '退出选择',
    selected: (count) => `已选择 ${format.number(count)} 首歌曲`,
    addToList: '添加到歌单',
    addTag: '添加标签',
    writeToFiles: '写入文件',
    writeToFilesSpoken: '将所选歌曲的信息写入文件',

    swipePlayNext: '下一首播放',
    swipeQueue: '加入队列',
    queuedAll: (count) => `已将${common.tracks(count)}加入播放队列`,

    needsAccess: 'Jukebox 需要访问此设备上的音频文件。',
    nothingIn: (folder) => `${folder} 中没有内容。`,
    shuffleAll: '全部随机播放',
    playsEverythingBelow: 'Jukebox 会播放该文件夹下的所有内容，包括子文件夹。',
    chooseFolderInSettings: '请在“设置”中选择音乐库文件夹。',

    folders: (count) => `${format.number(count)} 个文件夹`,
    noFolders: '这些歌曲都没有记录所在的文件夹。',
    shuffleTag: (tag) => `随机播放“${tag}”`,
  },

  row: {
    opensTracks: '打开其中的歌曲',
    selectsTracks: '选择其中的全部歌曲',
    select: '选择其中的歌曲',
  },

  rack: {
    open: (album) => `打开“${album}”`,
    openHint: '显示专辑中的歌曲',
    bringForward: '将这张专辑移到最前面',
  },

  albumActions: {
    select: { label: '选择', hint: '选中其中的歌曲，之后可继续点选其他项' },
    rest: {
      label: '查找这张专辑的其余歌曲',
      hint: '专辑中你还没有的歌曲',
    },
    lookUp: {
      label: '在线查询这张专辑',
      hint: '以整张专辑为单位，查询歌曲信息和封面',
    },
    cover: {
      label: '选择专辑封面',
      hint: '从相册选一张图片，用于专辑中的每首歌曲',
    },
  },

  albumTools: {
    lookingUp: (done, total) =>
      `正在查询这张专辑… ${format.number(done)} / ${format.number(total)}`,
    stop: '停止查询',
    lookedUp: (found, covers) =>
      found === 0 && covers === 0
        ? '没有为这张专辑找到新的信息。'
        : covers === 0
          ? `已找到 ${common.tracks(found)}的信息。`
          : found === 0
            ? `已为 ${common.tracks(covers)}找到封面。`
            : `已找到 ${common.tracks(found)}的信息，并为 ${common.tracks(covers)}找到封面。`,
    offline: '服务没有响应。请检查网络连接后重试。',
    failed: '查询意外停止。',
    coverChosen: (count) => `已为 ${common.tracks(count)}设置封面。`,
  },

  rest: {
    looking: '正在查询专辑…',
    release: (count, year) => (year ? `${common.tracks(count)}，${year}年` : common.tracks(count)),
    have: (have, total) => `共 ${format.number(total)} 首，你已拥有 ${format.number(have)} 首。`,
    complete: '你已拥有整张专辑。',
    rivals: '有不止一张专辑叫这个名字。这是与你的歌曲最吻合的一张。',
    unsure: '你的歌曲都没有在这张专辑中被识别出来，因此没有勾选任何项。请先确认这是不是正确的专辑。',
    disc: (disc) => `第 ${format.number(disc)} 张碟`,
    ordered: (count) => `已将 ${format.number(count)} 首歌曲按专辑顺序排列。`,
    undoOrder: '撤销',

    lookingTube: '正在 YouTube 上查找…',
    readingTube: '正在读取专辑…',
    source: {
      musicbrainz: '曲目列表来自 MusicBrainz',
      youtube: (playlist, channel) =>
        `曲目列表来自 YouTube：${[playlist, channel].filter(Boolean).join(' · ')}`,
    },
    other: { youtube: '改为在 YouTube 上查找', musicbrainz: '改用 MusicBrainz' },
    onTrust: '取自 YouTube 上同名的专辑。你拥有的歌曲太少，无法据此核对，下载前请先检查一遍。',
    tubeNotFound: '无法确认 YouTube 上有哪个播放列表是这张专辑。',

    ticks: '已勾选，等待下载',
    waiting: '排队中',
    searching: '正在 YouTube 上查找…',
    noMatch: '未找到匹配的录音',
    searchFailed: '搜索未能完成',
    byHand: '手动搜索',
    byHandLabel: (title) => `手动搜索“${title}”`,

    download: (count) => `下载 ${format.number(count)} 首歌曲`,
    nothingTicked: '勾选要下载的歌曲',
    stop: '停止搜索',

    failed: {
      unnamed: '无法查询这张专辑。它需要有专辑名，并且大部分歌曲的艺人一致。',
      notFound: 'MusicBrainz 上没有这位艺人的同名专辑。',
      offline: '无法连接 MusicBrainz。请检查网络连接后重试。',
      throttled: 'MusicBrainz 要求降低请求频率。请稍等一分钟后重试。',
      failed: '无法查询这张专辑。',
      gone: '这张专辑已不在音乐库中。',
      neither: '未找到这张专辑。MusicBrainz 中没有收录，也无法确认 YouTube 上有哪个播放列表是这张专辑。',
      tube: '无法向 YouTube 查询这张专辑。',
      tooOld: '此版本的 Jukebox 无法在 YouTube 上查询专辑。请安装新版应用。',
    },
  },

  menu: {
    playNext: { label: '下一首播放', hint: '在当前歌曲之后立即播放' },
    addToQueue: { label: common.addToQueue, hint: '添加到末尾' },
    album: { label: '前往专辑', hint: '按顺序查看这张专辑的其余歌曲' },
    addToPlaylist: { label: '添加到歌单', hint: '你的某个歌单，或新建一个' },
    tiles: { label: '玩钢琴块', hint: '琴键随这首歌的节奏落下' },
    details: {
      label: '查看和编辑信息',
      hint: '名称、封面、标签和歌词，均可在线查询',
    },
    /*
      Said in full, as in English: the same menu opens on a row of a list and
      of the queue, where a cross only takes the row out.
    */
    delete: { label: '从手机中删除', hint: '删除文件本身，而不只是这一行' },
  },

  folders: {
    needsAccess: 'Jukebox 需要先获得此设备上音频文件的访问权限，才能列出文件夹。',
    note: 'Jukebox 会播放你所选文件夹下的所有内容，包括子文件夹。选择某个子文件夹，就可以排除铃声和游戏音频。',
    everything: (path) => `${path}（全部）`,
  },

  leftOut: {
    title: '已排除的文件夹',
    none: '无。可以关闭存放语音消息、录音或铃声的文件夹。',
    some: (count) => `已从音乐库排除 ${format.number(count)} 个文件夹`,
    note: '关闭的文件夹及其中的所有文件夹都不会出现在音乐库中。不会删除任何内容：收听记录、标签和在歌单中的位置都会保留，重新开启后即可恢复。',
    within: '随所在的文件夹一起排除',
    spoken: (path, count) => `${path}，${format.number(count)} 首歌曲`,
    hint: '开启时文件夹包含在音乐库中，关闭时排除',
    empty: (root) => `${root} 中没有包含音乐的文件夹。`,
  },

  shortFiles: {
    title: '隐藏短文件',
    note: '按时长排除语音消息、铃声和通知音。不会删除任何内容。',
    under: (seconds) => `短于 ${format.number(seconds)} 秒`,
    shorterThan: (seconds) => `短于 ${format.number(seconds)} 秒`,
  },

  copies: {
    title: '同一首歌的副本',
    some: (count) =>
      `音乐库中有 ${format.number(count)} 首歌存了不止一份`,
    review: '查看',
    reviewHint: '打开副本，选择保留哪一份',
    note: '这些文件看起来是同一段录音保存了不止一次：文件名相同，或艺术家和标题相同，并且时长相差不超过两秒。每首歌保留一份副本。删除其他副本之前，会先把它们的收听记录、标签、歌词以及在歌单中的位置转移到保留的那一份。',
    empty: '音乐库中没有存了不止一份的歌。',
    cleanAll: (count) => `全部清理（${format.number(count)} 首）`,
    confirmAll: (files, songs) =>
      `删除 ${format.number(files)} 个文件？这 ${format.number(songs)} 首歌各保留一份副本，每个被删除文件的收听记录、标签、歌词以及在歌单中的位置会先转移到保留的副本。删除前 Android 还会再确认一次。`,
    confirm: (files) => `删除 ${format.number(files)} 个文件`,
    deleteOthers: (count) => (count === 1 ? '删除另一份副本' : `删除其他 ${format.number(count)} 份副本`),
    different: '这些是不同的歌',
    choose: '保留哪一份',
    keepHint: '保留这一份，删除其他副本',
    keeps: '保留',
    goes: '删除',
    why: {
      listens: '推荐保留：收听次数最多。',
      described: '推荐保留：有信息或封面。',
      folder: '推荐保留：位于音乐库文件夹中。',
      larger: '推荐保留：文件更大。',
      older: '推荐保留：文件更早。',
      alike: '这些副本完全相同，保留哪一份都可以。',
    },
    yourChoice: '将保留你选择的副本。',
    holds: (copy) => {
      const parts = [copy.listens > 0 ? `${format.number(copy.listens)} 次收听` : '没有收听记录'];
      if (copy.described) parts.push('有信息');
      if (copy.cover) parts.push('有封面');
      if (copy.outside) parts.push('在音乐库文件夹之外');
      return parts.join(' · ');
    },
    deleted: (count) => `已删除 ${format.number(count)} 个文件。`,
    notDeleted: '文件未被删除。它们的收听记录等内容已转移到保留的副本。',
    failed: (error) => `部分记录无法转移，这些文件未做改动。${error}`,
  },

  wrong: {
    title: '可能下错歌曲的下载',
    some: (count) =>
      `有 ${format.number(count)} 个下载可能不是名称所写的那首歌曲`,
    review: '查看',
    reviewHint: '打开这些下载，逐一更正',
    note: '这些文件都是作为某首歌曲下载的，并使用了那首歌曲的名称，但来源视频的标题却是别的，所以可能是另一首歌曲。先播放听一听，再给它改用视频的名称、删除它，或确认它没有错。在你选择之前不会做任何改动。',
    empty: '没有看起来下错的歌曲。',
    filedAs: '保存的名称',
    videoWas: '视频标题',
    facts: (length, listens) => `${length} · ${listens > 0 ? `${format.number(listens)} 次收听` : '未收听'}`,
    playHint: '播放此文件',
    rename: '改成真实名称',
    delete: '删除',
    right: '没有错',
    sheetNote: '取自视频标题。如有出入请修改。它会保存为你的编辑，在线查询不会覆盖。',
    titleField: '标题',
    artistField: '艺人',
    renamed: (title) => `已改名为“${title}”。`,
    deleted: '已删除。',
    notDeleted: '文件未被删除。',
    keptRight: '保持原样，以后不会再询问。',
    failed: (error) => `无法完成。${error}`,
  },
};
