import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const downloads: Strings['downloads'] = {
  short: (underWay, waiting, paused) => {
    if (paused) return waiting > 0 ? `Duraklatıldı · ${format.number(waiting)} bekliyor` : 'Duraklatıldı';
    if (underWay > 0 && waiting > 0) return `${format.number(underWay)} indiriliyor, ${format.number(waiting)} bekliyor`;
    if (underWay > 0) return `${format.number(underWay)} indiriliyor`;
    return waiting > 0 ? `${format.number(waiting)} bekliyor` : '';
  },
  state: (underWay, waiting, paused) => {
    if (paused) return waiting > 0 ? `Duraklatıldı, ${format.number(waiting)} bekliyor` : 'Duraklatıldı';
    if (underWay > 0 && waiting > 0) return `${format.number(underWay)} indiriliyor, ${format.number(waiting)} bekliyor`;
    if (underWay > 0) return `${format.number(underWay)} indiriliyor`;
    return waiting > 0 ? `${format.number(waiting)} bekliyor` : 'Şu anda bir şey indirilmiyor';
  },
  pausedNote: 'Sen devam ettirene kadar yeni indirme başlamaz. İndirilmekte olan tamamlanır.',
  automaticNote: (count) =>
    count === 1
      ? 'Bir indirme otomatik: onu Keşfet istedi. Başka bir şey indirilmediğinde sırası gelir.'
      : `${format.number(count)} indirme otomatik: onları Keşfet istedi. Başka bir şey indirilmediğinde sıraları gelir.`,

  pause: 'Duraklat',
  resume: 'Devam et',
  cancelAll: 'Tümünü iptal et',
  cancelAllQuestion: 'Bütün indirmeler iptal edilsin mi?',
  cancelAllHint: 'Bekleyenlerin ve indirilmekte olanların hepsi iptal edilir. Kütüphanene girmiş olanlar kalır.',
  keep: 'Vazgeç',

  sections: { now: 'Şimdi', next: 'Sırada', history: 'Geçmiş' },
  clear: 'Temizle',
  clearLabel: 'İndirme geçmişini temizle',

  source: {
    discover: 'Keşfet',
    search: 'Arama',
    album: (name) => `Albüm: ${name}`,
    playlist: (name) => `Oynatma listesi: ${name}`,
  },
  automatic: 'Otomatik · diğerlerini bekliyor',
  retrying: (why) => (why ? `Yeniden denenecek · ${why}` : 'Yeniden denenecek'),

  doNext: 'Sıradaki bu olsun',
  doNextLabel: (title) => `Sıradaki bu olsun: ${title}`,
  cancelLabel: (title) => `İptal et: ${title}`,
  retryLabel: (title) => `Yeniden dene: ${title}`,
  moveUp: 'Yukarı taşı',
  moveDown: 'Aşağı taşı',

  empty: {
    heading: 'Henüz indirme yok',
    body: 'Ara sekmesinden, Keşfet’ten ya da bir albümü tamamlamak için indirdiklerin, sırasını bekleyenlerle birlikte burada listelenir.',
  },
  unavailable: 'Müzik indirebilmek için güncel sürümü yükle.',
  readFailed: 'İndirmeler okunamadı.',

  extractor: {
    heading: 'YouTube indiricisi',
    version: (version) => `yt-dlp ${version}`,
    current: 'Güncel',
    available: (version) => `${version} sürümü çıkmış`,
    unchecked: 'Yenisi var mı diye henüz bakılmadı',
    checked: (days) =>
      days === 0 ? 'bugün bakıldı' : days === 1 ? 'dün bakıldı' : `${format.number(days)} gün önce bakıldı`,
    check: 'Güncellemeye bak',
    checking: 'Bakılıyor…',
    update: 'Güncelle',
    waiting: 'Süren indirmenin bitmesi bekleniyor…',
    downloading: (version, percent) => `${version} indiriliyor · %${format.number(percent)}`,
    trying: 'Yeni sürüm deneniyor…',
    restoring: 'Jukebox’la gelen sürüm geri konuyor…',
    updated: (version) => `Artık ${version} kullanılıyor. Başarısız olan indirmeler yeniden denenebilir.`,
    restore: (version) => `Jukebox’la gelen ${version} sürümüne dön`,
    checkFailed: 'Güncellemeye bakılamadı.',
    trouble: {
      network: 'GitHub’a ulaşılamadı. Bağlantını kontrol edip yeniden dene.',
      answer: 'GitHub bir sürümle yanıt vermedi. Daha sonra yeniden dene.',
      checksum: 'Gelen dosya, sürümün listesindeki dosya değil. Hiçbir şey değiştirilmedi.',
      broken: 'Yeni sürüm bu telefonda çalışmıyor. Eskisi yerinde duruyor.',
      failed: 'Güncellenemedi. Eski sürüm yerinde duruyor.',
    },
    rowUpdate: 'Güncelle',
    rowCheck: 'Denetle',
    rowUpdateLabel: (title) => `YouTube indiricisini güncelle, sonra yeniden dene: ${title}`,
    rowCheckLabel: (title) => `Yeni bir YouTube indiricisi var mı bak, sonra yeniden dene: ${title}`,
  },

  button: {
    label: (state) => (state ? `İndirmeler: ${state}` : 'İndirmeler'),
    finished: 'tamamlandı',
    heading: 'İndirmeler',
    idle: 'Şu anda bir şey indirilmiyor',
    paused: 'Duraklatıldı',
    allDone: 'Hepsi tamamlandı',
    waiting: (count) => `${format.number(count)} bekliyor`,
    done: (count) => `${format.number(count)} tamamlandı`,
    failed: (count) => `${format.number(count)} başarısız`,
    open: 'İndirmeleri aç',
  },
};
