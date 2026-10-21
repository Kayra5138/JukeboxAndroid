import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const discover: Strings['discover'] = {
  panel: {
    heading: 'Bir sonraki dinleyişin için',
    refresh: 'Yenile',
    updated: (date) => `Güncellendi: ${date}`,

    familiar: (because) => `Sanatçılarından başka şarkılar · ${because}`,
    fresh: (because) => `Yeni bir sanatçı · ${because}`,
  },

  header: {
    notYet: 'Henüz liste yok',
    about: 'Keşfet hakkında',
    settings: 'Keşfet ayarları',
    findMore: 'Daha fazla bul',
    dismiss: 'Kapat',
  },

  about: {
    heading: 'Keşfet hakkında',
    what:
      'Sende henüz olmayan şarkılar; son 30 günde dinlediklerine göre seçilir: sanatçılarından başka şarkılar ve onlara yakın sanatçılar.',
    source:
      'Dinlediklerin bu telefonda okunur. Öneriler ListenBrainz ve MusicBrainz’den gelir; bir şarkının sesi, çalınacağı zaman YouTube’dan indirilir.',
    keep: 'Kütüphane’de tut, şarkıyı Kütüphane’ne ekler. Şarkı bulunmuş olur ve listeden çıkar.',
    exclude:
      'Bu şarkı olmasın, şarkıyı listeden çıkarır ve şarkı bir daha önerilmez. Menüden aynısını sanatçısı için de söyleyebilirsin.',
    room: 'İkisinde de yerine başka bir şarkı gelir. Aynısını satırı yana çekerek de yapabilirsin; fazlası için satıra basılı tut.',
  },

  row: {
    keep: 'Kütüphane’de tut',
    exclude: 'Bu şarkı olmasın',
    swipeKeep: 'Tut',
    swipeExclude: 'Olmasın',
    willPlay: 'Hazır olunca çalacak',
    preview: 'Ön dinleme · şarkı yolda',
    previewStop: 'Ön dinlemeyi durdurur. Şarkı hazır olunca yine çalar',
    willKeep: 'Hazır olunca Kütüphane’ye',
    keeping: 'Kütüphane’ye kaydediliyor…',
    failed: 'İndirilemedi · yeniden denemek için dokun',
    needsBuild: 'Güncel sürüm gerekiyor',
    waitingWifi: 'Wi-Fi bekleniyor · indirmek için dokun',
    percent: (percent) => `%${format.number(percent)}`,
    gettingReady: 'İndiriliyor',
    hint: 'Şarkıyı çalar; gerekirse önce indirir',
    nowPlaying: (title) => `Çalıyor: ${title}`,
    menu: 'Şarkı seçenekleri',
  },

  menu: {
    play: { label: 'Çal', hint: 'Gerekirse önce indirilir' },
    keep: { label: 'Kütüphane’de tut', hint: 'Artık senin olur ve bu listeden çıkar' },
    exclude: { label: 'Bu şarkı olmasın', hint: 'Listeden çıkar ve bir daha önerilmez' },
    neverArtist: {
      label: (artist) => `${artist} hiç olmasın`,
      hint: 'Bu sanatçının hiçbir şarkısı bir daha önerilmez',
    },
    why: 'Neden bu şarkı',
    seeds: (artists) => `Dinlediklerinden: ${artists}`,
    tags: (tags) => `Türü: ${tags}`,
    freshArtist: 'Kütüphanende olmayan bir sanatçı',
  },

  empty: {
    building: 'Listen hazırlanıyor…',
    none: 'Henüz bir liste yok. Yenile’ye dokun; Keşfet dinlediklerinden bir liste hazırlasın.',
    findingMore: 'Başka şarkılar aranıyor…',
    short: (missing) => `${format.number(missing)} yer boş.`,
  },

  player: {
    kept: 'Kütüphane’ye kaydedildi',
  },

  preview: {
    label: 'Ön dinleme',
    note: 'Şarkının tamamı hazır olunca başlayacak',
    stop: 'Ön dinlemeyi durdur',
  },

  settings: {
    heading: 'Keşfet',
    title: 'Keşfet ayarları',
    count: 'Keşif şarkıları',
    countNote:
      'Yarısı tanıdık sanatçılar, yarısı yeni. Kaydedilen ve hariç tutulan şarkıların yerine hemen yenisi gelir.',
    refresh: 'Listeyi yenile',
    everyDays: (days) => `${format.number(days)} gün`,
    manual: 'Elle',
    refreshNote:
      'Arka plandaki işlerin ne zaman çalışacağına Android karar verir. Zamanı geçmiş bir yenileme, Jukebox’ı yeniden açtığında da yapılır. Kaydedilmemiş keşiflerin yerine yenileri gelir; sıradaki şarkılar, çalma işi bitene kadar tutulur.',
    ready: 'Sıradaki şarkıları hazır tut',
    readyNone: 'Hiçbiri',
    readyNote:
      'Dokunduğunda hemen çalsın diye önceden indirilir: listenin ilk şarkıları ya da çalanın ardından gelenler. Hiçbiri seçiliyse şarkı, ona dokunduğunda indirilir.',
    wifi: 'Şarkıları yalnızca Wi-Fi’da hazır tut',
    wifiNote:
      'Kotasız Wi-Fi kullanır. Dokunduğun şarkı, o an hangi bağlantı varsa onunla indirilir.',
    preview: 'Şarkı inerken ön dinleme çal',
    previewNote:
      'Dokunduğun şarkı henüz hazır değilse hemen Deezer’dan 30 saniyelik bir ön dinlemeyle başlar; şarkının tamamı indiğinde baştan çalmaya geçer. Ön dinleme, dinleme olarak sayılmaz.',
    nextList: 'Şimdiki listen olduğu gibi kalır. Sonraki liste buna göre seçilir.',
    excluded: 'Hariç tutulan şarkılar',
    noneExcluded: 'Hariç tutulan şarkı yok.',
    allowAgain: 'Yeniden izin ver',
    allowAgainLabel: (title) => `Yeniden izin ver: ${title}`,
    unblock: 'Engeli kaldır',
    unblockLabel: (artist) => `Engeli kaldır: ${artist}`,
    failed: 'Keşfet ayarları güncellenemedi. Lütfen yeniden dene.',
  },

  state: {
    idle: 'İndirip çalmak için dokun',
    starting: 'Başlıyor…',
    waitingFind: 'Aranmayı bekliyor',
    waitingDownload: 'İndirilmeyi bekliyor',
    waitingRetry: 'Birazdan yeniden denenecek',
    finding: 'Kayıt aranıyor…',
    preparing: 'İndirme başlıyor…',
    downloading: (percent) => `İndiriliyor · %${format.number(percent)}`,
    converting: 'Tamamlanıyor…',
    saving: 'Neredeyse hazır…',
    ready: 'Çalmaya hazır',
    playing: 'Çalıyor',
    willPlay: (doing) => `${doing} Hazır olunca çalacak.`,
    preview: (doing) => `Ön dinleme çalıyor. ${doing}`,
    willKeep: (doing) => `${doing} Hazır olunca Kütüphane’ye kaydedilecek.`,
    keeping: 'Kütüphane’ye kaydediliyor…',
    waitingWifi: 'Wi-Fi bekleniyor · şimdi indirmek için dokun',
  },

  failure: {
    generic: 'Bu indirme tamamlanamadı.',
    fileMissing: 'Dosya artık telefonda değil.',
    noRecording: 'Bu şarkının bir kaydı bulunamadı.',
    notASong: 'Bu şarkı için bulunan video canlı bir yayın ya da şarkı olamayacak kadar uzun.',
    stopped: 'İndirme durduruldu.',
    needsBuild: 'Keşfet şarkılarını indirmek için güncel sürümü yükle.',
    retry: (reason) => `${reason} Yeniden denemek için dokun.`,
  },

  status: {
    building: 'Şarkılar aranıyor…',
    filling: (known, total) => `Şarkılar bulunuyor · ${format.number(known)}/${format.number(total)}`,
    findingOffline: 'Bağlantı yok. Listenin kalanı bağlantı gelince aranacak.',
    findingPaused: 'İndirmeler duraklatıldı. Sürdürürsen listenin kalanı aranır.',
    findingLater: 'Bazı şarkılar şu an kontrol edilemedi. Keşfet onları daha sonra yeniden dener.',
    buildingArtists: (done, total) =>
      `Şarkılar aranıyor · ${format.number(done)}/${format.number(total)} sanatçı`,
    preparing: (ready, target) =>
      `Yeni liste yolda · ${format.number(target)} şarkıdan ${format.number(ready)} tanesi hazır.${ready > 0 ? ' Şimdi görmek için yeniden Yenile’ye dokun.' : ''}`,
    offline: 'Bağlantı yok. Listen korundu; bağlantı gelince yeni şarkılar aranacak.',
    offlineEmpty: 'Bağlantı yok. Bağlantı gelince Keşfet listeni hazırlayacak.',
    noLibrary: 'Keşfet bu telefondaki müzikten yola çıkar, ama henüz hiç müzik bulamadı.',
    noTaste:
      'Şarkıların kime ait olduğu yazmıyor, bu yüzden Keşfet’in yola çıkacağı bir sanatçı yok. Bilgilerini Ayarlar → Kütüphane → Etiketler’den bulabilirsin.',
    unreachable: 'Önerilere ulaşılamadı. Listen korundu; lütfen daha sonra yeniden dene.',
    unreachableEmpty: 'Önerilere ulaşılamadı. Lütfen daha sonra yeniden dene.',
    exhausted: 'Henüz yeterince yeni şarkı yok. Listen olduğu gibi korundu.',
    exhaustedEmpty: 'Henüz önerecek yeni bir şey yok. Biraz daha dinleyip yeniden dene.',
    timedOut: 'Şarkıları aramak çok uzun sürdü ve durduruldu. Lütfen yeniden dene.',
    throttled: 'Keşfet az önce baktı. Bir dakika sonra yeniden dene.',
    failed: 'Keşfet tamamlanamadı. Lütfen yeniden dene.',
    waitingWifi: 'Sıradaki şarkılar Wi-Fi olunca indirilecek. Şimdi indirmek için bir şarkıya dokun.',
    waitingConnection: 'Sıradaki şarkılar bağlantı gelince indirilecek.',
    paused: 'İndirmeler duraklatıldı. Şarkıları indirmek için indirmeleri sürdür.',
  },

  notice: {
    kept: (title) => `${title} Kütüphane’ye kaydedildi.`,
    excluded: (title) => `${title} bir daha önerilmeyecek.`,
    excludedArtist: (artist) => `${artist} bir daha önerilmeyecek.`,
    restored: (title) => `${title} listeye geri alındı.`,
    refreshed: 'İşte yeni listen.',
    keepFailed: (title) => `${title} Kütüphane’ye kaydedilemedi. Lütfen yeniden dene.`,
    wrongFile: (title) => `${title} için indirilen dosya başka bir şarkıymış. Kaydetmek için doğrusu aranıyor.`,
    undo: 'Geri al',
  },

  engine: {
    needsTaste: 'Keşfet’in yola çıkacağı ne bir sanatçı ne de bir etiket var.',
    nothingFetched:
      'Öneri alınamadı. Şimdiki Keşfet listen korundu; lütfen daha sonra yeniden dene.',
  },

  taste: {
    popularity: 'Şarkıların bilinirliği',
    popularityKnown: 'Çok bilinenler',
    popularityAny: 'Fark etmez',
    popularityDeep: 'Az bilinenler',
    popularityNote:
      'Keşfet tanınmış sanatçılara ve en çok dinlenen şarkılarına mı, yoksa daha az kişinin bulduğu sanatçılara ve şarkılara mı ağırlık versin? Fark etmez dersen yeni bir sanatçıyı en bilinen şarkılarından biriyle tanıtır.',

    neverArtistLabel: (artist) => `Bir daha önerme: ${artist}`,
    blockedArtists: 'Engellenen sanatçılar',
    noneBlockedArtists: 'Engellenen sanatçı yok.',
    blockedArtistsNote:
      'Bir şarkıyı hariç tutman, sanatçısının da daha az önerilmesini sağlar. Aynı sanatçının üç şarkısını hariç tutarsan Keşfet o sanatçıyı altı ay boyunca önermez.',
  },

  why: {
    moreFrom: (artist) => `${artist} şarkılarından`,
    becauseYouPlay: (artists) => `${artists} dinlediğin için`,
    both: (first, second) => `${first} ve ${second}`,
    like: (artist) => `${artist} gibi`,
    withGenre: (line, genre) => `${line} · ${genre}`,
    fromTags: (tags) => `Dinlediğin türlerden: ${tags}`,
    unexplained: 'Senin için seçildi',
    veryNear: 'Dinlediklerine çok yakın',
    near: 'Dinlediklerine yakın',
    farther: 'Biraz daha uzaktan',
  },

  gathering: {
    around: (artist, done, total) =>
      `${artist} çevresi dinleniyor · ${format.number(done)} / ${format.number(total)} sanatçı`,
    artists: (done, total) => `${format.number(done)} / ${format.number(total)} sanatçı`,
    naming: 'Şarkıların adları öğreniliyor…',
    offline: 'Bağlantı yok. Keşfet, bağlantı olduğunda yeni şarkılar arayacak.',
    throttled: 'Öneri servisi Keşfet’ten yavaşlamasını istedi. Lütfen birkaç dakika sonra yeniden dene.',
    nothing: 'Bu sefer yeni bir şey bulunamadı. Şimdiki Keşfet listen korundu; lütfen daha sonra yeniden dene.',
  },
};
