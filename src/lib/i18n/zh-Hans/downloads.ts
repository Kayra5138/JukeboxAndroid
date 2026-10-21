import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const downloads: Strings['downloads'] = {
  short: (underWay, waiting, paused) => {
    if (paused) return waiting > 0 ? `已暂停 · ${format.number(waiting)} 个等待中` : '已暂停';
    if (underWay > 0 && waiting > 0) return `${format.number(underWay)} 个下载中，${format.number(waiting)} 个等待中`;
    if (underWay > 0) return `${format.number(underWay)} 个下载中`;
    return waiting > 0 ? `${format.number(waiting)} 个等待中` : '';
  },
  state: (underWay, waiting, paused) => {
    if (paused) return waiting > 0 ? `已暂停，${format.number(waiting)} 个等待中` : '已暂停';
    if (underWay > 0 && waiting > 0) return `正在下载 ${format.number(underWay)} 个，${format.number(waiting)} 个等待中`;
    if (underWay > 0) return `正在下载 ${format.number(underWay)} 个`;
    return waiting > 0 ? `${format.number(waiting)} 个等待中` : '没有正在下载的内容';
  },
  pausedNote: '在你恢复之前不会开始新的下载。正在进行的下载会继续完成。',
  automaticNote: (count) =>
    `有 ${format.number(count)} 个下载由“发现”自动发起，会等到没有其他下载时再开始。`,

  pause: '暂停',
  resume: '继续',
  cancelAll: '全部取消',
  cancelAllQuestion: '取消所有下载？',
  cancelAllHint: '所有等待中和正在下载的内容都会被取消。已在音乐库中的内容会保留。',
  keep: '保留',

  sections: { now: '正在下载', next: '等待中', history: '历史记录' },
  clear: '清除',
  clearLabel: '清除下载历史记录',

  source: {
    discover: '发现',
    search: '搜索',
    album: (name) => `专辑：${name}`,
    playlist: (name) => `播放列表：${name}`,
  },
  automatic: '自动 · 等待其他下载完成',
  retrying: (why) => (why ? `正在重试 · ${why}` : '正在重试'),

  doNext: '优先下载',
  doNextLabel: (title) => `优先下载“${title}”`,
  cancelLabel: (title) => `取消“${title}”`,
  retryLabel: (title) => `重试“${title}”`,
  moveUp: '上移',
  moveDown: '下移',

  empty: {
    heading: '还没有下载',
    body: '你从“搜索”“发现”中下载的内容，以及为补全专辑而下载的内容，都会列在这里，等待中的也会一并显示。',
  },
  unavailable: '请安装新版应用以下载音乐。',
  readFailed: '无法读取下载内容。',

  extractor: {
    heading: 'YouTube 下载器',
    version: (version) => `yt-dlp ${version}`,
    current: '已是最新版本',
    available: (version) => `${version} 可用`,
    unchecked: '尚未检查更新',
    checked: (days) =>
      days === 0 ? '今天检查过' : days === 1 ? '昨天检查过' : `${format.number(days)} 天前检查过`,
    check: '检查更新',
    checking: '正在检查…',
    update: '更新',
    waiting: '正在等待当前下载完成…',
    downloading: (version, percent) => `正在下载 ${version} · ${format.number(percent)}%`,
    trying: '正在试用新版本…',
    restoring: '正在恢复 Jukebox 自带的版本…',
    updated: (version) => `已更新到 ${version}。之前失败的下载可以重试了。`,
    restore: (version) => `恢复到 Jukebox 自带的 ${version}`,
    checkFailed: '无法检查更新。',
    trouble: {
      network: '无法连接 GitHub。请检查网络连接后重试。',
      answer: 'GitHub 没有返回可用的版本。请稍后重试。',
      checksum: '下载的文件与发布版本中列出的不一致。未做任何更改。',
      broken: '新版本无法在这台手机上运行。原来的版本仍在使用中。',
      failed: '无法更新。原来的版本仍在使用中。',
    },
    rowUpdate: '更新',
    rowCheck: '检查',
    rowUpdateLabel: (title) => `更新 YouTube 下载器，以重试“${title}”`,
    rowCheckLabel: (title) => `检查 YouTube 下载器更新，以重试“${title}”`,
  },

  button: {
    label: (state) => (state ? `下载：${state}` : '下载'),
    finished: '已完成',
    heading: '下载',
    idle: '当前没有正在下载的内容',
    paused: '已暂停',
    allDone: '全部完成',
    waiting: (count) => `${format.number(count)} 个等待中`,
    done: (count) => `${format.number(count)} 个已完成`,
    failed: (count) => `${format.number(count)} 个失败`,
    open: '打开下载',
  },
};
