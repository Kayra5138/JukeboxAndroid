import { common } from './common.ts';
import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const library: Strings['library'] = {
  views: {
    tracks: '歌曲',
    albums: '专辑',
    artists: '艺人',
    folders: '文件夹',
    tapes: '磁带',
  },

  tapes: {
    left: (minutes) => `剩余 ${format.number(minutes)} 分钟`,
    played: '已听完',
    heard: (heard, total) => `${format.number(heard)} / ${format.number(total)} 分钟`,
    add: '添加磁带',
    settings: '磁带设置',
    /** A followed show's arrow, which lays its episodes out under it and folds them away. */
    showEpisodes: '显示单集',
    hideEpisodes: '隐藏单集',
    /** A tape's own details screen: see `app/tape.tsx`. */
    details: {
      title: '磁带详情',
      listening: '收听',
      heard: '已听',
      notBegun: '尚未开始',
      lastHeard: '上次收听',
      part: '部分',
      partOf: (at, of) => `第 ${format.number(at)} 部分，共 ${format.number(of)} 部分`,
      speed: '速度',
      marks: '标记',
      source: '来源',
      from: '类型',
      kinds: { youtube: 'YouTube 视频', playlist: 'YouTube 播放列表', podcast: '播客单集', book: 'LibriVox 的图书', byHand: '手动放入磁带文件夹' },
      show: '节目',
      book: '图书',
      channel: '频道',
      list: '播放列表',
      published: '发布日期',
      fetched: '获取时间',
      chapters: '章节',
      skipped: '跳过的部分',
      skippedUnknown: '下次播放时查找',
      skippedOff: '已在磁带设置中关闭',
      skippedTrouble: '无法连接 SponsorBlock；下次播放时重试',
      skippedNone: '没有标记',
      skippedSome: (count, seconds) => `${format.number(count)} 处 · ${format.number(seconds)} 秒`,
      address: '地址',
      listAddress: '播放列表地址',
      openSeries: '打开节目',
      file: '文件',
      name: '名称',
      folder: '文件夹',
      format: '格式',
      size: '大小',
      megabytes: (mb) => `${format.number(mb)} MB`,
      added: '加入手机',
      missing: '这盘磁带已不在媒体库中。',
    },
    seriesHeading: '关注中',
    singlesHeading: '磁带',
    booksHeading: '图书',
    /** The tapes view's filter: all of it, or one of its parts. */
    filter: { all: '全部', series: '关注中', books: '图书', tapes: '磁带' },
    seriesLine: (count, fresh) => `${format.number(count)} 集${fresh > 0 ? ` · ${format.number(fresh)} 集未听` : ''}`,
    seriesNone: '尚未下载任何单集',
    /** A folder of several tapes as one row: how many parts, and how many of them not begun. */
    bookLine: (count, fresh) => `${format.number(count)} 个部分${fresh > 0 ? ` · ${format.number(fresh)} 个未开始` : ''}`,
    count: (count) => `${format.number(count)} 盘磁带`,
    /** Over the tapes view while tapes are being chosen. */
    selected: (count) => `已选择 ${format.number(count)} 盘磁带`,
    empty: (folder) => `把有声书、播客和长录音放进音乐库文件夹里名为“Tapes”的文件夹（${folder}）。它们会显示在这里，从你上次停下的地方继续播放，而且不会混进你的音乐。`,
    markPlayed: '标记为已听完',
    markUnplayed: '标记为未听',
  },

  nothingMatches: (query) => `没有与“${query}”匹配的结果。`,
  noAlbums: '还没有专辑。歌曲经过在线查询后，专辑才会出现——文件所在的文件夹并不算专辑。',
  back: '‹ 返回',
  trackMenu: '歌曲选项',
  albumMenu: '专辑选项',

  screen: {
    searchYouTube: (query: string) => `在 YouTube 上搜索“${query}”`,
    viewSwitch: '音乐库视图',
    searchHints: {
      tracks: '搜索歌名、艺人和标签',
      albums: '搜索专辑名、艺人和标签',
      artists: '搜索艺人',
      folders: '搜索文件夹',
      tapes: '搜索磁带、节目和作者',
    },
    sort: '排序',
    sortShort: { name: '名称', added: '最新', played: '最近', colour: '颜色' },
    sortedBy: {
      name: '按名称排序',
      added: '按添加时间排序',
      played: '按最近播放时间排序',
      colour: '按封面颜色排序',
    },
    sortHint: '更改音乐库的排列顺序',
    lookSwitch: '将此视图切换为另一种显示方式',
    view: '视图',
    looks: { list: '列表', shelves: '书架', rack: '唱片架', map: '地图' },
    shelf: { added: '最近添加', around: (hour: string) => `${hour} 前后`, repeat: '本月单曲循环', while: '许久未听', never: '从未播放', all: '全部歌曲', play: (name: string) => `播放${name}`, shuffle: (name: string) => `随机播放${name}`, queue: (name: string) => `将${name}加入播放队列` },
    artistMap: { drawing: '正在绘制地图…', shuffle: '随机播放其歌曲', open: '打开', with: '合作', lasso: '圈选艺人并随机播放', lassoHint: '圈出要随机播放的艺人', lassoChosen: '已圈选', putBackAll: '将手动移动的艺人放回原处', movedByHand: '手动移动', putBack: '放回' },
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
    setAside: { label: '搁置', hint: '其歌曲不出现在“歌曲”和全部随机播放中' },
    bringBack: { label: '恢复', hint: '其歌曲重新出现在“歌曲”和随机播放中' },
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
    quickNext: '下一首',
    quickQueue: '队列',
    quickList: '列表',
    playNext: { label: '下一首播放', hint: '在当前歌曲之后立即播放' },
    keepListened: { label: '保存到资料库', hint: '连同播放记录复制到你的资料库' },
    addToQueue: { label: common.addToQueue, hint: '添加到末尾' },
    playSimilar: { label: '播放并接相似歌曲', hint: '先播这首，然后加入一批相似歌曲' },
    playOnly: { label: '只播放这首', hint: '播放队列里只有这一首' },
    playFromStart: { label: '从头播放', hint: '忘记上次停下的位置' },
    series: { label: '打开节目', hint: '它的单集，以及新单集如何下载' },
    tapeFolder: { label: '打开所在文件夹', hint: '同一文件夹里的其他内容' },
    tapeDetails: { label: '查看详情', hint: '听到哪里、来源和文件' },
    share: { label: '分享', hint: '以音频发送：聊天中可直接播放' },
    shareFile: { label: '以文件分享', hint: '以文件本身发送：聊天中作为文档保存' },
    album: { label: '前往专辑', hint: '按顺序查看这张专辑的其余歌曲' },
    addToPlaylist: { label: '添加到歌单', hint: '你的某个歌单，或新建一个' },
    setAside: { label: '搁置', hint: '不出现在“歌曲”和全部随机播放中' },
    bringBack: { label: '恢复', hint: '重新出现在“歌曲”和随机播放中' },
    asideWith: { label: '随其他内容搁置', hint: '随专辑、艺人、文件夹或标签一起搁置，可在“已搁置”中恢复' },
    favoriteAdd: { label: "加入收藏", hint: "爱心填充的列表，最新的在最上面" },
    favoriteRemove: { label: "移出收藏", hint: "从爱心填充的列表中移出" },
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

  setAside: {
    title: '已搁置',
    none: '无。可以把不想出现在“歌曲”和随机播放里的专辑、艺人或歌曲搁置起来。',
    some: (count) => `已搁置 ${format.number(count)} 首歌曲`,
    note: '搁置的歌曲不会出现在“歌曲”中，不参与全部随机播放，也不会被选来让音乐继续播放。它仍在所属专辑、艺人和文件夹里，在你的列表和搜索中，播放这些时照常播放。不会删除任何内容。',
    empty: '没有搁置任何内容。长按专辑或歌曲，或打开艺人或文件夹，即可搁置。',
    kinds: { album: '专辑', artist: '艺人', list: '列表', folder: '文件夹', tag: '标签', track: '歌曲' },
    songs: (count) => `${format.number(count)} 首歌曲`,
    bringBack: '恢复',
    bringBackSpoken: (name) => `恢复${name}`,
    addTag: '搁置一个标签',
    noTags: '没有更多可搁置的标签了。',
    album: { set: '搁置这张专辑', back: '恢复这张专辑' },
    artist: { set: '搁置这位艺人', back: '恢复这位艺人' },
    list: { set: '搁置这个列表', back: '恢复这个列表' },
    folder: { set: '搁置这个文件夹', back: '恢复这个文件夹' },
  },

  shortFiles: {
    title: '隐藏短文件',
    note: '按时长排除语音消息、铃声和通知音。不会删除任何内容。',
    under: (seconds) => `短于 ${format.number(seconds)} 秒`,
    shorterThan: (seconds) => `短于 ${format.number(seconds)} 秒`,
  },

  autoWrite: {
    heading: "写入文件",
    edits: { title: "将我保存的内容写入文件", note: "保存歌曲详情时（单首或多首），也会像“写入文件”一样写进文件。对于不是 Jukebox 下载的文件，Android 会先询问。" },
    lookups: { title: "将搜索找到的内容写入文件", note: "搜索匹配到且你未编辑过的歌曲，其详情会写入文件。Jukebox 自己下载的文件会立即写入，后台也可以。其他文件会等待，下次打开应用时一并询问。正在播放的歌曲等下次再写。" },
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

  shuffle: {
    menu: '随机播放',
    everything: '所有歌曲',
    change: '更改按钮播放的内容…',
    heading: '随机播放按钮播放',
    note: '长按按钮可单次随机播放其他内容。小组件和车载也播放相同内容。',
    labelHeading: '随机播放按钮显示',
    label: { name: '所播放内容的名称', words: '自定义文字', icon: '不显示文字，只显示图标' },
    wordsHeading: '随机播放按钮上的文字',
    wordsPlaceholder: '随机播放',
    spoken: (name) => `随机播放：${name}`,
  },
};
