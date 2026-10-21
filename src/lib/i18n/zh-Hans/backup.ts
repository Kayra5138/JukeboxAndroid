import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const backup: Strings['backup'] = {
  imported: '导入完成',
  importedBody: '所有内容均已导入。Jukebox 需要重新启动才能显示：当前屏幕上的内容是导入之前读取的。',
  restart: '重启 Jukebox',

  question: '导入此备份？',
  made: (when, app) => {
    if (when && app) return `由 Jukebox ${app} 于 ${when} 创建。`;
    if (when) return `创建于 ${when}。`;
    if (app) return `由 Jukebox ${app} 创建的备份。`;
    return '一份备份。';
  },
  listens: (count) => `${format.number(count)} 条收听记录`,
  tagged: (count) => `${format.number(count)} 首带标签的歌曲`,
  withLyrics: (count) => `${format.number(count)} 首带歌词的歌曲`,

  songs: (found, total) => {
    if (total === 0) return '其中不包含任何歌曲。';
    const missing = total - found;
    const here = `备份中的 ${format.number(total)} 首歌曲里，有 ${format.number(found)} 首在你的音乐库中。`;
    return missing > 0
      ? `${here}其余 ${format.number(missing)} 首不在这台手机上。它们的收听记录会保留，但标签、歌词和在歌单中的位置找不到对应的歌曲，将不会导入。`
      : here;
  },

  importing: '正在导入…',
  merge: '合并',
  mergeHint: '添加到现有内容中。不会删除这台手机上的任何内容。',
  replace: '替换',
  replaceHint: '删除现有的全部内容，改用备份中的内容。此操作无法撤销。',

  notABackup: '该文件不是 Jukebox 备份。',
  newer: '该备份由较新版本的 Jukebox 创建。请更新应用后再读取。',
  needsBuildToExport: '请安装新版应用以使用导出功能。',
  needsBuildToImport: '请安装新版应用以使用导入功能。',
};
