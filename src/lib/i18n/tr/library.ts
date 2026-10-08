import { common } from './common.ts';
import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const library: Strings['library'] = {
  views: {
    tracks: 'Parçalar',
    albums: 'Albümler',
    artists: 'Sanatçılar',
    folders: 'Klasörler',
  },

  nothingMatches: (query) => `“${query}” ile eşleşen bir şey yok.`,
  noAlbums:
    'Henüz albüm yok. Bir albüm ancak parçalarının bilgileri arandıktan sonra görünür; bir dosyanın bulunduğu klasör albüm sayılmaz.',
  back: '‹ Geri',
  trackMenu: 'Parça seçenekleri',
  albumMenu: 'Albüm seçenekleri',

  screen: {
    viewSwitch: 'Kütüphane görünümü',
    searchHints: {
      tracks: 'Parça adı, sanatçı ve etiket ara',
      albums: 'Parça adı, sanatçı ve etiket ara',
      artists: 'Sanatçı ara',
      folders: 'Klasör ara',
    },
    sort: 'Sıralama',
    sortShort: { name: 'A–Z', added: 'Eklenme', played: 'Dinlenme' },
    sortedBy: {
      name: 'Ada göre sıralı',
      added: 'Eklenme zamanına göre sıralı',
      played: 'Son dinlenme zamanına göre sıralı',
    },
    sortHint: 'Kütüphanenin sıralamasını değiştirir',
    groupSortShort: { name: 'A–Z', tracks: 'Parça', played: 'Dinlenme', added: 'Yeni' },
    groupSortedBy: {
      name: 'Ada göre sıralı',
      tracks: 'Parça sayısına göre sıralı',
      played: 'Dinlenme sayısına göre sıralı',
      added: 'En son eklenene göre sıralı',
    },

    selectTracks: 'Parça seç',
    stopSelecting: 'Seçimi bitir',
    selected: (count) => `${format.number(count)} parça seçildi`,
    addToList: 'Listeye ekle',
    addTag: 'Etiket ekle',
    writeToFiles: 'Dosyalara yaz',
    writeToFilesSpoken: 'Seçili parçaların bilgilerini dosyalarına yaz',

    swipePlayNext: 'Sonraki olarak çal',

    needsAccess: 'Jukebox’ın bu cihazdaki seslere erişmesi gerekiyor.',
    nothingIn: (folder) => `${folder} klasöründe hiçbir şey yok.`,
    playsEverythingBelow: 'Jukebox, alt klasörler dahil o klasörün altındaki her şeyi çalar.',
    chooseFolderInSettings: 'Kütüphane klasörünü Ayarlar’dan seçebilirsin.',

    folders: (count) => `${format.number(count)} klasör`,
    noFolders: 'Bu parçaların hiçbiri hangi klasörde olduğunu söylemiyor.',
    shuffleTag: (tag) => `“${tag}” etiketini karıştır`,
  },

  row: {
    opensTracks: 'Parçalarını açar',
    selectsTracks: 'Bütün parçalarını seçer',
    select: 'Parçalarını seç',
  },

  rack: {
    open: (album) => `${album} albümünü aç`,
    openHint: 'Albümdeki parçaları gösterir',
  },

  albumActions: {
    select: { label: 'Seç', hint: 'Bu albümün parçaları, sonra dokunduğun diğerleri' },
    rest: {
      label: 'Albümün geri kalanını bul',
      hint: 'Albümde olup sende henüz olmayan parçalar',
    },
  },

  rest: {
    looking: 'Albüm aranıyor…',
    release: (count, year) => (year ? `${common.tracks(count)}, ${year}` : common.tracks(count)),
    have: (have, total) =>
      `${format.number(total)} parçadan ${format.number(have)} tanesi sende var.`,
    complete: 'Albümün tamamı sende var.',
    rivals: 'Bu adı taşıyan birden fazla albüm var. Bu, parçalarına en çok uyanı.',
    unsure:
      'Parçalarının hiçbiri bu albümde tanınmadı, o yüzden hiçbiri işaretli değil. Önce doğru albüm olduğundan emin ol.',
    disc: (disc) => `Disk ${format.number(disc)}`,

    lookingTube: 'YouTube’da aranıyor…',
    readingTube: 'Albüm okunuyor…',
    source: {
      musicbrainz: 'Parça listesi MusicBrainz’den',
      youtube: (playlist, channel) =>
        `Parça listesi YouTube’dan: ${[playlist, channel].filter(Boolean).join(' · ')}`,
    },
    other: { youtube: 'Bunun yerine YouTube’da ara', musicbrainz: 'Bunun yerine MusicBrainz’i kullan' },
    onTrust:
      'YouTube’un bu addaki albümünden alındı. Karşılaştırmaya yetecek kadar parçan yok, o yüzden indirmeden önce bir göz at.',
    tubeNotFound: 'YouTube’da bu albüm olduğu doğrulanabilen bir oynatma listesi yok.',

    ticks: 'İndirilmek üzere işaretli',
    waiting: 'Sırasını bekliyor',
    searching: 'YouTube’da aranıyor…',
    noMatch: 'Uyan bir kayıt bulunamadı',
    searchFailed: 'Arama yapılamadı',
    byHand: 'Elle ara',
    byHandLabel: (title) => `${title} parçasını elle ara`,

    download: (count) => `${format.number(count)} parçayı indir`,
    nothingTicked: 'İndirilecek parçaları işaretle',
    stop: 'Aramayı durdur',

    failed: {
      unnamed:
        'Bu albüm aranamıyor. Bir adı ve parçalarının çoğunun ortak olduğu tek bir sanatçısı olmalı.',
      notFound: 'MusicBrainz’de bu sanatçının bu adda bir albümü yok.',
      offline: 'MusicBrainz’e ulaşılamadı. Bağlantını kontrol edip yeniden dene.',
      throttled: 'MusicBrainz yavaşlamamızı istedi. Bir dakika bekleyip yeniden dene.',
      failed: 'Albüm aranamadı.',
      gone: 'Bu albüm artık kütüphanede değil.',
      neither:
        'Bu albüm bulunamadı. MusicBrainz’de yok, YouTube’da da bu albüm olduğu doğrulanabilen bir oynatma listesi yok.',
      tube: 'YouTube’a albüm sorulamadı.',
      tooOld: 'Jukebox’ın bu sürümü albümleri YouTube’da arayamıyor. Daha yeni bir Android sürümü kur.',
    },
  },

  menu: {
    playNext: { label: 'Sonraki olarak çal', hint: 'Çalan parçanın hemen ardından' },
    addToQueue: { label: common.addToQueue, hint: 'En sona' },
    album: { label: 'Albüme git', hint: 'Albümün geri kalanı, sırasıyla' },
    addToPlaylist: { label: 'Listeye ekle', hint: 'Listelerinden biri ya da yeni bir liste' },
    tiles: { label: 'Piyano karoları oyna', hint: 'Bu parçanın ritmiyle düşen tuşlar' },
    details: {
      label: 'Ayrıntıları gör ve düzenle',
      hint: 'Adlar, kapak, etiketler ve sözler; her biri için arama da var',
    },
    delete: { label: 'Telefondan sil', hint: 'Yalnızca bu satırı değil, dosyanın kendisini siler' },
  },

  folders: {
    needsAccess:
      'Jukebox’ın klasörleri listeleyebilmesi için önce bu cihazdaki seslere erişmesi gerekiyor.',
    note: 'Jukebox, alt klasörler dahil seçtiğin klasörün altındaki her şeyi çalar. Zil seslerini ve oyun seslerini dışarıda bırakmanın yolu bir alt klasör seçmektir.',
    everything: (path) => `${path}  (her şey)`,
  },
};
