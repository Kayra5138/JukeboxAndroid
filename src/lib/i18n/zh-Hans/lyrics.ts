import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const lyrics: Strings['lyrics'] = {
  none: '未找到歌词。',
  translating: '正在翻译…',
  seekTo: (seconds) => `跳到第 ${seconds} 秒`,

  translation: {
    romaji: '这是用拉丁字母拼写的日语，且未找到原文写法的版本可供翻译。',
    unsupported: '暂不支持翻译这种语言的歌词。',
    unavailable: '此设备无法使用翻译功能。',
    misaligned: '译文与原歌词无法逐行对应。',
    failed: '翻译失败。',
  },

  from: {
    file: '来自文件本身',
    lrc: '来自 .lrc 文件',
    lookup: '来自 LRCLIB',
  },

  stored: (timed, from, lines) =>
    `${timed ? '同步歌词' : '纯文本'}，${from === 'file' ? '来自文件本身' : '来自旁边的 .lrc 文件'}` +
    (lines > 0 ? ` · ${format.number(lines)} 行` : ''),

  found: {
    file: '已在文件本身中找到并保存。',
    lrc: '已在歌曲旁边的 .lrc 文件中找到并保存。',
  },

  folders: {
    title: '读取歌曲旁边的 .lrc 文件',
    note: '与歌曲同名的 .lrc 文件中的歌词会优先于在线查询显示。Android 只允许应用从你选择的文件夹中读取这类文件，因此会请你选择一次存放音乐的文件夹。',
    add: '添加其他文件夹',
    remove: '移除',
    removeLabel: (folder) => `停止读取“${folder}”中的 .lrc 文件`,
    elsewhere: '此文件夹不在这台手机上，因此其中没有音乐库里的歌曲。请选择手机上存放音乐的文件夹。',
  },
};
