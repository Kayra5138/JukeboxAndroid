import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const discover: Strings['discover'] = {
  panel: {
    heading: 'Bir sonraki dinleyişin için',
    mix: (count) => `${format.number(count)} keşif · yarısı tanıdık, yarısı yeni sanatçılar`,
    refresh: 'Yenile',
    about:
      'Son 30 gününe göre hazırlanır. + şarkıyı Kütüphane’de tutar. − şarkıyı sonraki keşiflerden çıkarır. İkisi de başka bir şarkıya yer açar.',
    updated: (date) => `Güncellendi: ${date}`,
    preparing: 'Keşfet hazırlanıyor…',
    nextList: (ready, count) =>
      `Sonraki liste hazırlanıyor · ${format.number(ready)}/${format.number(count)} hazır. Yeni liste hazır olana kadar şimdiki şarkıların kullanılabilir. Hazırlık takılırsa yeniden denemek için Yenile’ye dokun.`,
    saved: (title) => `${title} Kütüphane’ye kaydedildi.`,
    restored: 'Şarkı Keşfet’e geri alındı.',
    excludedUndo: 'Şarkı hariç tutuldu · Geri al',

    finding: 'Bir sonraki şarkın aranıyor…',
    waitingToBeFound: 'Bulunmayı bekleyen bir keşif var',
    place: (place, count) => `Sıra ${format.number(place)} / ${format.number(count)}`,

    playLabel: (title) => `Çal: ${title}`,
    keepLabel: (title) => `Kütüphane’de tut: ${title}`,
    neverLabel: (title) => `Bir daha önerme: ${title}`,
    familiar: (because) => `Sanatçılarından başka şarkılar · ${because}`,
    fresh: (because) => `Yeni bir sanatçı · ${because}`,
    songPreparing: 'Hazırlanıyor…',
    ready: 'Çalmaya hazır',
    waitingToDownload: 'İndirilmeyi bekliyor',
    tapToDownload: 'İndirip çalmak için dokun',
  },

  settings: {
    heading: 'Keşfet',
    count: 'Keşif şarkıları',
    countNote:
      'Yarısı tanıdık sanatçılar, yarısı yeni. Kaydedilen ve hariç tutulan şarkıların yerine hemen yenisi gelir.',
    refresh: 'Listeyi yenile',
    everyDays: (days) => `${format.number(days)} gün`,
    manual: 'Elle',
    refreshNote:
      'Arka plandaki işlerin ne zaman çalışacağına Android karar verir. Zamanı geçmiş bir yenileme, Jukebox’ı yeniden açtığında da yapılır. Kaydedilmemiş keşiflerin yerine yenileri gelir; sıradaki şarkılar, çalma işi bitene kadar tutulur.',
    auto: 'Otomatik indir',
    autoNote: 'MP3 ses. Kapalıyken, indirip dinlemeye başlamak için bir şarkıya dokun.',
    wifi: 'Otomatik indirmeler yalnızca Wi-Fi’da',
    wifiNote:
      'Kotasız Wi-Fi kullanır. Bir şarkıya dokunarak başlattığın indirmeler mobil veri kullanabilir.',
    wifiNoteOff:
      'Bunu seçmek için otomatik indirmeyi aç. Bir şarkıya dokunarak başlattığın indirmeler mobil veri kullanabilir.',
    excluded: (open) => `Hariç tutulan şarkılar ${open ? '−' : '+'}`,
    noneExcluded: 'Hariç tutulan şarkı yok.',
    allowAgain: 'Yeniden izin ver',
    failed: 'Keşfet ayarları güncellenemedi. Lütfen yeniden dene.',
  },

  engine: {
    checking: 'Keşfet kontrol ediliyor…',
    learning: (artist) => `${artist} inceleniyor…`,
    exploring: (tags) => `${tags} keşfediliyor…`,
    findingSongs: (artist) => `${artist} şarkıları aranıyor…`,
    findingAudio: (title) => `Ses aranıyor: ${title}…`,
    waitingWifi: 'Kotasız Wi-Fi bekleniyor',
    waitingConnection: 'Bağlantı bekleniyor',

    noMatch: 'Eşleşen bir stüdyo kaydı bulunamadı. Yerini başka bir şarkı alıyor.',
    downloadFailed: 'Bu indirme tamamlanamadı. Lütfen daha sonra yeniden dene.',
    failed: 'Keşfet tamamlanamadı. Lütfen yeniden dene.',
    fileMissing: 'Dosya yok. Yeniden indirmek için dokun.',
    downloadStopped: 'İndirme durdu. Yeniden denemek için dokun.',
    notEnough: 'Henüz yeterince yeni şarkı yok. Şimdiki listen korundu.',
    needsBuild: 'Keşfet şarkılarını indirmek için güncel sürümü yükle.',
    needsTaste:
      'Keşfet’in zevkini tanıyabilmesi için biraz müzik ekle ya da birkaç şarkı dinle.',
    nothingFetched:
      'Öneri alınamadı. Şimdiki Keşfet listen korundu; lütfen daha sonra yeniden dene.',
    cancelled: 'Çalma isteği iptal edildi.',
    changed: 'Bu öneri değişti. Başka bir şarkı seç.',
    gone: 'Bu şarkı artık Keşfet’te değil.',
    tooLong: 'İndirme çok uzun sürüyor. Lütfen yeniden dene.',
    unavailable: 'Şarkı artık kullanılamıyor.',
  },
};
