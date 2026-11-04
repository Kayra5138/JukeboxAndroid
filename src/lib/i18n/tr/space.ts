import { common } from './common.ts';
import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const space: Strings['space'] = {
  title: 'Yer aç',
  rowNote: 'Hiç dinlemediğin, atladığın ya da iki kez olan şarkılar ve en büyük dosyalar',
  note: 'Telefonda yer açmak için gidebilecek şarkılar, her biri nedeniyle. Gitmesini istediklerini işaretle; bir şey silinmeden önce Android bir kez daha sorar.',
  groups: {
    copy: 'Aynı şarkının kopyaları',
    skipped: 'Sık atlananlar',
    neverPlayed: 'Hiç çalınmayanlar',
    forgotten: 'Uzun zamandır çalınmayanlar',
    large: 'En büyük dosyalar',
  },
  groupSize: (count, size) => `${common.songs(count)} · ${size}`,
  megabytes: (mb) => `${format.decimal(mb, 1)} MB`,
  gigabytes: (gb) => `${format.decimal(gb, 1)} GB`,
  why: {
    copy: 'Bu şarkının başka bir kopyası kalır, dinlemeleri ona geçer',
    skipped: (skips, heard, after) =>
      heard === 0
        ? `${format.number(skips)} kez atlandı, ortalama ${format.number(after)}. saniyede, hiç sonuna kadar dinlenmedi`
        : `${format.number(skips)} kez atlandı, ortalama ${format.number(after)}. saniyede, ${format.number(heard)} kez sonuna kadar dinlendi`,
    neverPlayed: (added) => `Hiç çalınmadı, ${format.date(new Date(added))} tarihinden beri telefonda`,
    forgotten: (last) => `En son ${format.date(new Date(last))} tarihinde çalındı`,
    large: 'En büyük dosyalardan biri',
  },
  listSeparator: ', ',
  inLists: (names) => `Listeler: ${names}`,
  showHint: 'Bu gruptaki şarkıları gösterir ya da gizler',
  tickGroup: (group) => `Tümü: ${group}`,
  delete: (count, size) => `${format.number(count)} şarkıyı sil (${size})`,
  freed: (count, size) => `${common.songs(count)} silindi, ${size} yer açıldı.`,
  notDeleted: 'Hiçbir şey silinmedi.',
  empty: 'Açılacak yer yok: her şarkı yakın zamanda dinlenmiş, hiçbiri sık atlanmıyor ve hiçbiri iki kez yok.',
  auto: {
    heading: 'Kendiliğinden',
    title: 'Dinlenmeyen indirmeleri sil',
    off: 'Kapalı. Jukebox’ın kendi indirdiği şarkılar, bir süre kimse dinlemediğinde kendiliğinden silinebilir. Başka yoldan gelen dosyalara hiç dokunulmaz.',
    after: (count) =>
      `Jukebox’ın kendi indirdiği şarkılar ${format.number(count)} ay dinlenmeden geçince silinir; günde bir kez bakılır. Çalan şarkı ve başka yoldan gelen dosyalar asla silinmez.`,
    months: 'Dinlenmeden geçen ay',
    monthCount: (count) => `${format.number(count)} ay`,
    favorites: 'Favorilerdeki şarkılar da',
    lists: 'Listelerdeki şarkılar da',
  },
};
