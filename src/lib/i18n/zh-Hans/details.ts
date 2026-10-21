import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

const files = (count: number) => `${format.number(count)} 个文件`;

/** What a file's fields are called in a line that says which were written. */
const FIELD_NAMES: Record<string, string> = {
  title: '标题',
  artist: '艺人',
  album: '专辑',
  albumArtist: '专辑艺人',
  genre: '流派',
  year: '年份',
  track: '音轨号',
  disc: '碟片号',
  cover: '封面',
};

/** `标题、艺人和专辑`: a list is joined with the enumeration comma, and its last with 和. */
function listed(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join('、')}和${items[items.length - 1]}`;
}

export const details: Strings['details'] = {
  screen: {
    tabs: { general: '常规', tags: '标签', lyrics: '歌词' },
    missing: '这首歌已不在音乐库中。它可能已被删除、移动，或不在 Jukebox 读取的文件夹内。',
    goBack: '返回',
  },

  lookUp: '在线查询',
  searchFailed: '搜索未能完成。',

  general: {
    fields: {
      title: '标题',
      artist: '艺人',
      album: '专辑',
      albumArtist: '专辑艺人',
      year: '发行年份',
      trackNumber: '音轨号',
      discNumber: '碟片号',
    },
    notAYear: '这不是有效的年份。',
    notAPlace: '请输入从 1 开始的整数。',

    chooseCoverLabel: '从相册中选择封面',
    noCover: '无封面',
    chooseFromGallery: '从相册中选择',
    removeCover: '移除封面',
    keepCover: '保留原有封面',
    coverChosen: '已选择封面。保存后生效。',

    lookUpHint: '按下方填写的标题和艺人进行搜索，并填入找到的信息：名称、专辑、年份、在专辑中的位置以及封面。',
    nothingFound: '未找到与该标题和艺人匹配的信息。',
    found: (sources, withCover) =>
      `在 ${sources.join(' 和 ')} 上找到${withCover ? '，包括封面' : ''}。请核对后保存。`,

    discard: '放弃我的编辑',
    saveHint: '在这里保存的内容会被视为你的编辑：之后重新查询音乐库时，不会覆盖这首歌的信息。',
    editGone: '你的编辑已清除。可以通过在线查询重新填写。',

    inFile: '文件中的信息',
    writeLabel: '将这些信息写入文件',
    writeToFile: '写入文件',
    saveFirst: '请先保存。只有已保存的内容才会写入文件。',
    writeHint:
      '将音乐库中显示的标题、艺人、专辑、年份、音轨号和碟片号，第一个标签（作为流派），' +
      '以及在这里保存的封面，写入文件本身，让其他播放器和设备也能读取。' +
      '更改前 Android 会先征求你的同意。文件中的其他内容保持不变，歌词不会被写入。',
    cannotWrite: '只能写入 MP3 和 FLAC 文件。这首歌的信息只保存在应用中。',
    nothingWritten: '没有写入任何内容。',
    couldNotWrite: '无法写入。',

    listening: '收听情况',
    timesPlayed: '播放次数',
    playedToEnd: '完整播放',
    timeSpent: '收听时长',
    firstPlayed: '首次播放',
    lastPlayed: '最近播放',
    never: '从未',
    listenedSeconds: (seconds) => `${format.number(seconds)} 秒`,
    listenedMinutes: (minutes) => `${format.number(minutes)} 分钟`,
    listenedHours: (hours, minutes) => `${format.number(hours)} 小时 ${minutes} 分钟`,

    file: '文件',
    name: '名称',
    folder: '文件夹',
    length: '时长',
    detailsFrom: '信息来源',
    unknown: '未知',
    from: {
      notLookedUp: '未查询',
      yourEdit: '你的编辑',
      notFound: '未找到',
      lookup: '在线查询',
    },
  },

  tags: {
    lookUpHint: '在线查询这首歌的标签。你手动输入的标签会保留；之前查询得到的标签将被这次的结果替换。',
    noneFound: '未找到这首歌的标签。',
    found: (count, source) => `从 ${source} 找到 ${format.number(count)} 个标签。整理好后保存即可。`,
    saveHint: '第一个标签会被视为流派。你手动输入的标签会被保留，之后的查询都不会删除它。',
  },

  editor: {
    label: '标签',
    add: '添加标签',
    moveUp: (tag) => `上移标签“${tag}”`,
    moveDown: (tag) => `下移标签“${tag}”`,
    remove: (tag) => `移除标签“${tag}”`,
  },

  tagPrompt: {
    heading: (count) => `为 ${format.number(count)} 首歌曲添加标签`,
    placeholder: '标签',
  },

  lyrics: {
    lookUpHint: '像播放时一样搜索这首歌的歌词，找到后会替换已保存的歌词。',
    nothingMatched: '没有与这首歌匹配的歌词。下方的手动搜索不设任何筛选。',
    foundAndSaved: '已找到并保存。',
    nothingCameBack: '没有搜索结果。',
    cleared: '已清除。下次查询时会重新搜索。',
    notSeconds: '这不是有效的秒数。',

    stored: '已保存的歌词',
    none: '暂无',
    kept: (timed, byHand, lines) =>
      `${timed ? '同步歌词' : '纯文本'}，${byHand ? '手动选择' : '来自 LRCLIB'}` +
      (lines > 0 ? ` · ${format.number(lines)} 行` : ''),
    forget: '清除并重新查询',
    saveChanges: '保存更改',
    timedHint: '每行前面都带有时间。修改歌词时请保留方括号，否则该行会失去时间位置。',
    plainHint: '可以随意修改。保存的歌词会被视为你的编辑，任何查询都不会替换它。',

    timing: '时间偏移',
    timingHint:
      '一次性平移所有歌词行。适用于歌词正确但出现得太早或太晚的情况——打开播放器微调直到对齐，或点按数值直接输入。正值会让歌词出现得更晚。',
    earlier: (seconds) => `−${seconds} 秒`,
    later: (seconds) => `+${seconds} 秒`,
    shiftedEarlier: (written) => `−${written} 秒`,
    shiftedLater: (written) => `+${written} 秒`,
    noShift: '无偏移',
    reset: '重置',
    offsetHeading: '歌词偏差了多少？',
    offsetPlaceholder: '秒数，例如 1.5 或 -0.75',
    typeOffset: '输入精确的偏移量',
    wordsField: '歌词',

    byHand: '手动搜索',
    byHandHint: '这里不排除任何结果，与自动搜索不同——自动搜索会拒绝时长不符的歌词，这也是有些歌曲始终找不到歌词的原因。',
    queryPlaceholder: '艺人和歌名',
    candidateTimed: '同步',
    candidatePlain: '纯文本',

    paste: '粘贴',
    pasteHint: '支持 LRC 文件或纯文本歌词。带时间戳的会作为同步歌词保存。',
    savePasted: '保存粘贴的歌词',
  },

  library: {
    coversSaved: (count) => `已添加 ${format.number(count)} 张专辑封面。`,
    stoppedOffline: (matched) =>
      `服务没有响应，因此在匹配 ${format.number(matched)} 首后停止。其余歌曲没有写入任何内容——它们仍在等待查询。`,
    serviceUnreachable: (service) =>
      `无法连接 ${service}，因此跳过它继续查询。需要它的内容保持原样，下次会再试。`,
    stoppedUnexpectedly: '查询意外停止。',

    nothingAnswered: '服务没有响应，正在停止。',
    rateLimited: '其中一个服务要求暂停，一分钟后会再次请求。',
    lookingUp: '正在查询…',
    lookingUpProgress: (done, total) =>
      `正在查询… 共 ${format.number(total)} 首，已完成 ${format.number(done)} 首`,
    lookingUpAlbum: (album, done, total) =>
      `正在查询“${album}”… 共 ${format.number(total)} 首，已完成 ${format.number(done)} 首`,
    soFar: (matched, covers) =>
      `目前已匹配 ${format.number(matched)} 首，找到 ${format.number(covers)} 张封面`,
    stop: '停止',
    lookupChannel: '信息查找',

    selected: (count) => `已选择 ${format.number(count)} 首`,
    summary: (matched, edited, notFound, untried) =>
      [
        `已匹配 ${format.number(matched)}`,
        edited > 0 ? `已编辑 ${format.number(edited)}` : null,
        `未找到 ${format.number(notFound)}`,
        `未查询 ${format.number(untried)}`,
      ]
        .filter(Boolean)
        .join(' · '),
    reset: '重置',
    lookUpMissing: '查询缺失信息',
    hint: '点按歌曲可手动修正。沿复选框向下拖动可连续选择。',
    searchPlaceholder: '在这些歌曲中搜索',

    noGenre: '无流派',
    noMatch: '未找到匹配',
    notLookedUp: '尚未查询',
    matchedSpoken: (artist, title) => `已匹配：${artist} — ${title}`,
    manualSpoken: (artist, title) => `手动设置：${artist} — ${title}`,
  },

  selection: {
    more: '更多…',
    moreHint: '可对所选歌曲执行的所有操作',
    heading: (count) => `已选择 ${format.number(count)} 首歌曲`,
    sections: { find: '在线查询', change: '编辑', other: '其他' },
    actions: {
      lookUp: {
        label: '在线查询歌曲信息',
        hint: '忘掉之前为它们查到的信息并重新查询，包括封面。你自己编辑的内容会保留。',
      },
      covers: {
        label: '在线查询封面',
        hint: '只为没有封面的歌曲查找封面，不会重新查询其他信息。你选择或移除的封面保持不变。',
      },
      lyrics: {
        label: '在线查询歌词',
        hint: '先从文件和 .lrc 文件中查找，再到 LRCLIB 查询。你选择的歌词会保留。',
      },
      edit: {
        label: '批量编辑信息',
        hint: '艺人、专辑艺人、专辑或年份，一次性设置到所有歌曲',
      },
      addTag: { label: '添加标签', hint: '为所有歌曲添加同一个标签' },
      removeTag: { label: '移除标签', hint: '从所有歌曲中移除其中一个标签' },
      cover: { label: '选择封面', hint: '从相册选一张图片，用于所有歌曲' },
      write: {
        label: '写入文件',
        hint: '将音乐库中显示的信息写入文件本身。Android 会先征求你的同意。',
      },
      addToList: { label: '添加到歌单', hint: '放入你的某个歌单' },
      reset: {
        label: '重置',
        hint: '忘掉在线查询为它们找到的信息。你自己编辑的内容会保留。',
      },
      delete: { label: '从手机中删除', hint: '删除这些文件。Android 会先征求你的同意。' },
    },
    busy: '另一项查询正在进行。请等它完成，或将其停止。',

    editHeading: (count) => `编辑 ${format.number(count)} 首歌曲`,
    editHint:
      '只填写所有歌曲都应相同的项目。留空的项目保持各首歌曲原样；要在所有歌曲中清空某项，请勾选其下方的选项。标题、音轨号和碟片号不会改动。',
    keepEach: '各自保持原样',
    empty: '未填写',
    clearOn: { remove: '从所有歌曲中移除', own: '使用各文件中的艺人' },
    cleared: { remove: '将从所有歌曲中移除', own: '各文件中的艺人' },
    edited: (count) =>
      `已为 ${format.number(count)} 首歌曲保存。这些现在算作你的编辑，在线查询不会覆盖。`,

    tagAdded: (tag, count) => `已为 ${format.number(count)} 首歌曲添加“${tag}”。`,
    removeTagHeading: (count) => `从 ${format.number(count)} 首歌曲中移除标签`,
    tagOption: (tag, count) => `${tag} · ${format.number(count)}`,
    noTags: '这些歌曲都没有标签。',
    tagRemoved: (tag, count) => `已从 ${format.number(count)} 首歌曲中移除“${tag}”。`,

    resetQuestion: (count) => `要重置 ${format.number(count)} 首歌曲吗？`,
    resetBody:
      '在线查询为它们找到的信息将被忘掉，它们将被视为未查询。你自己编辑的内容会保留。此操作无法撤销。',

    coversProgress: (done, total) =>
      `正在查找封面… 已完成 ${format.number(done)} / ${format.number(total)} 首`,
    coversNone: '没有找到新的封面。',
    lyricsProgress: (done, total) =>
      `正在查找歌词… 已完成 ${format.number(done)} / ${format.number(total)} 首`,
    lyricsSoFar: (found) => `目前已找到 ${format.number(found)} 首`,
    lyricsFound: (found, wanted, had) =>
      [
        wanted > 0
          ? `${format.number(wanted)} 首中有 ${format.number(found)} 首找到了歌词。`
          : null,
        had > 0 ? `${format.number(had)} 首已有歌词。` : null,
      ]
        .filter(Boolean)
        .join('') || '没有需要查找的：这些歌曲的歌词是你自己选择的。',
    lyricsOffline: '无法连接 LRCLIB，查询已停止。其余的可以稍后再试。',
  },

  write: {
    heading: (count) => `将信息写入 ${files(count)}？`,
    body: (count) =>
      `将更改 ${files(count)}：音乐库中显示的标题、艺人、专辑、年份、音轨号和碟片号，` +
      '第一个标签（作为流派）以及已保存的封面，都会写入文件本身。Android 会请你确认授权。' +
      '文件中的其他内容保持不变。',
    noneHeading: '这些文件都无法写入',
    noneBody: '只能写入 MP3 和 FLAC 文件，且不能写入正在播放的歌曲。',
    skipping: (otherKind, playing) =>
      otherKind > 0 && playing
        ? `将跳过 ${format.number(otherKind)} 个其他格式的文件，以及正在播放的歌曲。`
        : otherKind > 0
          ? `将跳过 ${format.number(otherKind)} 个其他格式的文件。`
          : '将跳过正在播放的歌曲。',
    confirmLabel: (count) => `将信息写入 ${files(count)}`,
    confirm: '写入',
    nothingWritten: '没有写入任何内容。',
    couldNotStart: '无法开始。',

    writing: '正在写入文件',
    progressLabel: (done, total) => `${files(total)}中已写入 ${format.number(done)} 个`,
    progress: (done, total) => `${format.number(done)} / ${format.number(total)}`,
    stopping: '写完当前文件后停止。',
    keepOpen: '每个文件在改动原文件前都会先经过检查。请保持应用打开。',
    stopLabel: '写完当前文件后停止',
    stop: '停止',
    stoppedShort: (count) => `已停止，${files(count)}未处理。`,

    written: (changed) =>
      changed.length > 0
        ? `已写入：${listed(changed.map((name) => FIELD_NAMES[name] ?? name))}。`
        : '已写入。',
    unchanged: '文件中的信息已完全一致，未做更改。',
    skippedPlaying: '已跳过：正在播放。停止播放后再试。',
    skippedFormat: '已跳过：只能写入 MP3 和 FLAC 文件。',
    failed: (reason) => `失败：${reason}`,
    noReason: '无法写入。文件未被改动。',

    summary: (counts) => {
      const parts: string[] = [];
      if (counts.written > 0) parts.push(`已写入 ${files(counts.written)}。`);
      if (counts.unchanged > 0) parts.push(`${files(counts.unchanged)}已一致。`);
      if (counts.skipped > 0) parts.push(`已跳过 ${files(counts.skipped)}。`);
      if (counts.failed > 0) parts.push(`${files(counts.failed)}写入失败。`);
      return parts.length > 0 ? parts.join('') : '没有需要写入的内容。';
    },
  },

  same: {
    note: '下面每一对文件看起来都是同一首歌。合并会把第一个文件的所有内容转移到第二个文件：收听记录、标签、歌词以及在歌单中的位置。保持独立则两者都保持原样，之后也不会再询问这一对文件。',
    failed: (error) => `操作失败，未做任何更改。${error}`,
    empty: '没有需要处理的了。',
    from: '来源',
    into: '合并到',
    keepApart: '保持独立',
    merge: '合并',
    bulk: {
      mergeDelete: '合并并删除来源文件',
      deleteToo: '同时删除每一对中的来源文件',
      deleteNote: '删除前 Android 会先确认。',
      notDeleted: '文件未被删除。',
      deleted: (count) => `已删除 ${format.number(count)} 个文件。`,
      choose: '选择这一对',
      chosen: (count) => `已选 ${format.number(count)} 对`,
      merge: (count) => `合并 ${format.number(count)} 对`,
      keepApart: (count) => `保持 ${format.number(count)} 对独立`,
      confirm: (count) =>
        count === 1
          ? '合并 1 对？第一个文件的收听记录、标签、歌词以及在歌单中的位置都会转移到第二个文件，之后无法再拆分。'
          : `合并 ${format.number(count)} 对？每一对中，第一个文件的收听记录、标签、歌词以及在歌单中的位置都会转移到第二个文件，之后无法再拆分。`,
      done: (done, skipped) =>
        skipped > 0
          ? `已处理 ${format.number(done)} 对；另有 ${format.number(skipped)} 对已随其他操作一并处理。`
          : `已处理 ${format.number(done)} 对。`,
    },
    unknown: '未知',
    noFileName: '文件名未知',
    holds: (side) => {
      const parts: string[] = [];
      if (side.listens > 0) parts.push(`${format.number(side.listens)} 次收听`);
      if (side.tags > 0) parts.push(`${format.number(side.tags)} 个标签`);
      if (side.lyrics) parts.push('有歌词');
      if (side.lists > 0) parts.push(`在 ${format.number(side.lists)} 个歌单中`);
      return parts.length > 0 ? parts.join(' · ') : '暂无内容';
    },
  },
};
