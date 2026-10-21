import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

/*
  Chinese does not change a noun after a number; it puts a measure word
  between them instead — 首 for songs, 张 for albums, 位 for artists, 个 for
  lists and files — so every count here is one wording.
*/
export const common: Strings['common'] = {
  cancel: '取消',
  save: '保存',
  done: '完成',
  ok: '确定',
  close: '关闭',
  back: '返回',
  delete: '删除',
  remove: '移除',
  add: '添加',
  edit: '编辑',
  rename: '重命名',
  yes: '是',
  no: '否',
  tryAgain: '重试',
  retry: '重试',
  import: '导入',
  clear: '清除',
  selectAll: '全选',
  off: '关闭',
  saved: '已保存',
  loading: '加载中…',

  search: '搜索',
  clearSearch: '清除搜索',

  play: '播放',
  pause: '暂停',
  nextTrack: '下一首',
  previousTrack: '上一首',
  shuffle: '随机播放',
  addToQueue: '添加到播放队列',
  moveUp: '上移',
  moveDown: '下移',

  unknownArtist: '未知艺人',
  unknownAlbum: '未知专辑',

  tracks: (count) => `${format.number(count)} 首歌曲`,
  songs: (count) => `${format.number(count)} 首歌曲`,
  albums: (count) => `${format.number(count)} 张专辑`,
  artists: (count) => `${format.number(count)} 位艺人`,
  lists: (count) => `${format.number(count)} 个歌单`,
  files: (count) => `${format.number(count)} 个文件`,
  minutes: (count) => `${format.number(count)} 分钟`,
  hours: (count) => `${format.number(count)} 小时`,

  fileUnreadable: '无法读取该文件。',
  pictureFailed: '无法加载该图片。',

  drawFailed: '显示此页面时出错了。',
};
