import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const lists: Strings['lists'] = {
  naming: {
    heading: '为歌单命名',
    placeholder: '歌单名称',
    create: '创建',
  },

  screen: {
    newList: '新建歌单',
    fromTag: '从标签创建',
    empty: '还没有歌单。歌单是你亲自排定的顺序——这正是标签做不到的。',
    followingTag: (count, tag) => `${format.number(count)} 首歌曲 · 跟随标签“${tag}”`,
    fromListening: '根据你的收听',
    discover: '发现',
    discoverHint: '根据你常听的内容，推荐你还没有的音乐',

    tagSheet: {
      heading: '从标签创建歌单',
      follows: '跟随标签',
      copy: '复制一份',
      followsHint: '始终包含带有该标签的所有歌曲。以后给歌曲加上这个标签，它就会出现在这里；其中的歌曲不能重新排序或移除。',
      copyHint: '获取当前带有该标签的所有歌曲。之后两者互不影响，歌单可由你随意编排。',
      noTags: '还没有标签。请先在线查询一些歌曲。',
    },
  },

  auto: {
    mostPlayed: { name: '最常播放', hint: '你反复回味的歌' },
    recentlyFound: { name: '本月新听', hint: '本月初以来首次听到的歌' },
    forgotten: { name: '被遗忘的', hint: '曾经常听，但已半年没听过的歌' },
    skipped: { name: '最常跳过', hint: '你总是按下一首跳过的歌' },
  },

  picker: {
    heading: (count) => `将 ${format.number(count)} 首歌曲添加到歌单`,
    noLists: '还没有歌单。',
    newList: '新建歌单…',
    already: (list) => `已在“${list}”中`,
    added: (count, list) => `已将 ${format.number(count)} 首歌曲添加到“${list}”`,
  },

  trackPicker: {
    heading: '添加歌曲',
    search: '搜索音乐库',
    alreadyHere: '已在此歌单中',
    add: (count) => `添加 ${format.number(count)} 首歌曲`,
  },

  list: {
    album: '专辑',
    artist: '艺人',
    folder: '文件夹',
    list: '歌单',

    everythingTagged: (tag) => `当前所有带有标签“${tag}”的歌曲`,
    away: (count) => `另有 ${format.number(count)} 首目前不在音乐库中`,

    addTracks: '添加歌曲',
    cover: '封面',
    deleteList: '删除歌单',

    albums: '专辑',
    tracks: '歌曲',
    opensAlbum: '打开专辑',

    empty: {
      editable: '这里还是空的。可以在上方添加歌曲，或从音乐库中把歌曲添加到这里。',
      tag: '还没有歌曲带有这个标签。给几首歌加上它，它们就会出现在这里。',
      album: '这张专辑已不在音乐库中。',
      artist: '音乐库中已没有署名这位艺人的歌曲。',
      folder: '这个文件夹里已经没有内容了。',
      auto: '还没有符合条件的歌曲。先听一些歌吧。',
    },

    mightBelong: '可能适合这里',
    mightBelongHint: '根据这个歌单主要使用的标签来判断，并做了加权：罕见的标签比音乐库里一半歌曲都有的标签更有分量。',

    choosePicture: '选择图片…',
    firstFour: '使用前四首的封面',

    renameHeading: '重命名歌单',
    deleteQuestion: (name) => `删除“${name}”？`,
    deleteHint: '只删除歌单，歌曲仍保留在手机上。',
  },

  files: {
    importFiles: '导入 M3U 歌单…',
    exportAll: '导出全部歌单…',
    export: '导出…',
    untitled: '导入的歌单',
    reading: '正在读取 M3U 文件…',

    conflict: {
      heading: (name) => `已有名为“${name}”的歌单`,
      hint: '文件可以替换它的内容并保留封面，也可以作为单独的歌单导入。',
      replace: '替换',
      keepBoth: (name) => `导入为“${name}”`,
      skip: '跳过此文件',
    },

    result: {
      heading: '已导入',
      imported: (name, found, total) =>
        `已导入歌单“${name}”：${format.number(total)} 首中找到 ${format.number(found)} 首`,
      repeated: (count) => `有 ${format.number(count)} 首歌曲在文件中出现了不止一次；歌单中每首只保留一次。`,
      showMissing: (count) => `查看未找到的 ${format.number(count)} 首`,
      hideMissing: '收起',
      reasons: {
        notFound: '音乐库中没有匹配的歌曲',
        ambiguous: '匹配的歌曲不止一首',
        web: '这是网址，不是文件',
      },
      tooBig: (file) => `${file} 太大，不像是 M3U 文件。`,
      unreadable: (file) => `无法将 ${file} 作为 M3U 文件读取。`,
      empty: (file) => `${file} 中没有内容。`,
      skipped: (file) => `已跳过 ${file}。`,
      encoding: (encoding) => `按 ${encoding} 读取`,
      open: '打开',
    },

    exportSheet: {
      heading: '导出为 M3U 文件',
      headingAll: '导出全部歌单',
      phone: '手机上的路径',
      phoneHint: '完整路径，如 /storage/emulated/0/Music/…，无论文件放在哪里，这部手机上的其他播放器都能识别。',
      library: '从音乐库文件夹开始',
      libraryHint: '从音乐库文件夹内开始的路径，适用于存有相同音乐的电脑。请把文件放在该文件夹的最上层。',
      save: '保存…',
      chooseFolder: '选择文件夹…',
      allHint: '在你选择的文件夹中，为每个歌单保存一个 .m3u8 文件。同名文件会被替换。',
    },

    saved: (name) => `已将“${name}”保存为 M3U 文件`,
    savedAll: (count, folder) => `已将 ${format.number(count)} 个歌单保存到 ${folder}`,
    notSaved: (names) => `未能保存：${names}`,
    leftOut: (count) => `有 ${format.number(count)} 首歌曲当前不在音乐库文件夹中，未包含在内。`,
    failed: (reason) => `操作失败：${reason}`,
  },
};
