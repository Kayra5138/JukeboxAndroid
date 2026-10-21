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
    swipeQueue: 'Sıraya ekle',
    queuedAll: (count) => `${common.tracks(count)} sıraya eklendi`,

    needsAccess: 'Jukebox’ın bu cihazdaki seslere erişmesi gerekiyor.',
    nothingIn: (folder) => `${folder} klasöründe hiçbir şey yok.`,
    shuffleAll: 'Hepsini karıştır',
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
    bringForward: 'Bu albümü öne getirir',
  },

  albumActions: {
    select: { label: 'Seç', hint: 'Bu albümün parçaları, sonra dokunduğun diğerleri' },
    rest: {
      label: 'Albümün geri kalanını bul',
      hint: 'Albümde olup sende henüz olmayan parçalar',
    },
    lookUp: {
      label: 'Albüm bilgilerini otomatik bul',
      hint: 'Bilgiler ve kapak, albümün tamamı için tek seferde aranır',
    },
    cover: {
      label: 'Albüm kapağı seç',
      hint: 'Galeriden bir resim, albümdeki her parça için',
    },
  },

  albumTools: {
    lookingUp: (done, total) =>
      `Albüm aranıyor… ${format.number(total)} parçadan ${format.number(done)} tanesi tamam`,
    stop: 'Aramayı durdur',
    lookedUp: (found, covers) =>
      found === 0 && covers === 0
        ? 'Bu albüm için yeni bir şey bulunamadı.'
        : covers === 0
          ? `${common.tracks(found)} için bilgi bulundu.`
          : found === 0
            ? `${common.tracks(covers)} için kapak bulundu.`
            : `${common.tracks(found)} için bilgi, ${common.tracks(covers)} için kapak bulundu.`,
    offline: 'Hiçbir yanıt gelmedi. Bağlantını kontrol edip yeniden dene.',
    failed: 'Arama beklenmedik şekilde durdu.',
    coverChosen: (count) => `Kapak ${common.tracks(count)} için ayarlandı.`,
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
    ordered: (count) => `${format.number(count)} parça albümdeki sırasına kondu.`,
    undoOrder: 'Geri al',

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

  leftOut: {
    title: 'Dışarıda bırakılan klasörler',
    none: 'Yok. Sesli mesaj, kayıt ya da zil sesi klasörlerini kapatabilirsin.',
    some: (count) => `${format.number(count)} klasör kütüphanenin dışında`,
    note: 'Kapattığın klasör, içindeki bütün klasörlerle birlikte kütüphanenin dışında kalır. Hiçbir şey silinmez: şarkıların dinlemeleri, etiketleri ve listelerdeki yerleri saklanır; klasörü yeniden açınca hepsi geri gelir.',
    within: 'İçinde bulunduğu klasörle birlikte dışarıda',
    spoken: (path, count) => `${path}, ${format.number(count)} parça`,
    hint: 'Açıksa klasör kütüphanede, kapalıysa dışarıda',
    empty: (root) => `${root} klasöründe müzik içeren bir alt klasör yok.`,
  },

  shortFiles: {
    title: 'Kısa dosyaları gizle',
    note: 'Sesli mesajları, zil seslerini ve bildirim seslerini uzunluklarına göre dışarıda bırakır. Hiçbir şey silinmez.',
    under: (seconds) => `${format.number(seconds)} sn altı`,
    shorterThan: (seconds) => `${format.number(seconds)} saniyeden kısa`,
  },

  copies: {
    title: 'Aynı şarkının kopyaları',
    some: (count) =>
      `${format.number(count)} şarkı kütüphanende birden fazla kez var`,
    review: 'İncele',
    reviewHint: 'Kopyaları açar; hangisinin kalacağını seçersin',
    note: 'Bu dosyalar aynı kaydın birden fazla kez kaydedilmiş hâline benziyor: adları ya da sanatçı ve şarkı adları aynı, süreleri en fazla iki saniye farklı. Her birinden bir kopya kalır. Diğerleri silinmeden önce dinlemeleri, etiketleri, sözleri ve listelerdeki yerleri kalan kopyaya aktarılır.',
    empty: 'Kütüphanende birden fazla kez bulunan şarkı yok.',
    cleanAll: (count) => `Tümünü temizle (${format.number(count)})`,
    confirmAll: (files, songs) =>
      `${format.number(files)} dosya silinsin mi? ${format.number(songs)} şarkının her birinden bir kopya kalır; silinen her dosyanın dinlemeleri, etiketleri, sözleri ve listelerdeki yerleri önce o kopyaya aktarılır. Bir şey silinmeden önce Android bir kez daha sorar.`,
    confirm: (files) => `${format.number(files)} dosyayı sil`,
    deleteOthers: (count) => (count === 1 ? 'Diğer kopyayı sil' : `Diğer ${format.number(count)} kopyayı sil`),
    different: 'Bunlar farklı şarkılar',
    choose: 'Hangi kopya kalsın',
    keepHint: 'Bu kopya kalır, diğerleri silinir',
    keeps: 'Kalacak',
    goes: 'Silinecek',
    why: {
      listens: 'En çok dinlenen bu olduğu için önerildi.',
      described: 'Ayrıntıları ya da kapağı olduğu için önerildi.',
      folder: 'Kütüphane klasöründe olduğu için önerildi.',
      larger: 'Daha büyük dosya olduğu için önerildi.',
      older: 'Daha eski dosya olduğu için önerildi.',
      alike: 'Kopyalar birbirinin aynı; hangisi kalsa olur.',
    },
    yourChoice: 'Senin seçtiğin kopya kalacak.',
    holds: (copy) => {
      const parts = [copy.listens > 0 ? `${format.number(copy.listens)} dinleme` : 'dinlenmemiş'];
      if (copy.described) parts.push('ayrıntılar');
      if (copy.cover) parts.push('kapak');
      if (copy.outside) parts.push('kütüphane klasörünün dışında');
      return parts.join(' · ');
    },
    deleted: (count) => `${format.number(count)} dosya silindi.`,
    notDeleted: 'Dosyalar silinmedi. Dinlemeleri ve geri kalanı artık kalan kopyada.',
    failed: (error) => `Bazı geçmişler aktarılamadı; o dosyalara dokunulmadı. ${error}`,
  },

  wrong: {
    title: 'Yanlış şarkı olabilecek indirmeler',
    some: (count) =>
      `${format.number(count)} indirme, adının söylediğinden başka bir şarkı olabilir`,
    review: 'İncele',
    reviewHint: 'Bu indirmeleri açar; her birini düzeltebilirsin',
    note: 'Bunların her biri bir şarkı olarak indirildi ve o şarkının adını aldı, ama geldiği videonun adı başka; yani başka bir şarkı olabilir. Hangisi olduğunu duymak için çal, sonra ona videonun adını ver, sil ya da olduğu gibi doğru olduğunu söyle. Sen seçmeden hiçbir şey değişmez.',
    empty: 'Yanlış şarkıya benzeyen indirme yok.',
    filedAs: 'Kayıtlı adı',
    videoWas: 'Videonun adı',
    facts: (length, listens) => `${length} · ${listens > 0 ? `${format.number(listens)} dinleme` : 'dinlenmemiş'}`,
    playHint: 'Bu dosyayı çalar',
    rename: 'Gerçek adını ver',
    delete: 'Sil',
    right: 'Bu doğru',
    sheetNote: 'Videonun adından alındı. Tam doğru değilse değiştir. Senin düzenlemen olarak kaydedilir; aramalar ona dokunmaz.',
    titleField: 'Şarkı adı',
    artistField: 'Sanatçı',
    renamed: (title) => `Adı “${title}” oldu.`,
    deleted: 'Silindi.',
    notDeleted: 'Dosya silinmedi.',
    keptRight: 'Olduğu gibi kaldı. Bir daha sorulmayacak.',
    failed: (error) => `Bu yapılamadı. ${error}`,
  },
};
