import { common } from './common.ts';
import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const library: Strings['library'] = {
  views: {
    tracks: 'Parçalar',
    albums: 'Albümler',
    artists: 'Sanatçılar',
    folders: 'Klasörler',
    tapes: 'Kasetler',
  },

  tapes: {
    left: (minutes) => `${format.number(minutes)} dk kaldı`,
    played: 'Dinlendi',
    heard: (heard, total) => `${format.number(heard)} / ${format.number(total)} dk`,
    add: 'Kaset ekle',
    settings: 'Kaset ayarları',
    /** A followed show's arrow, which lays its episodes out under it and folds them away. */
    showEpisodes: 'Bölümleri göster',
    hideEpisodes: 'Bölümleri gizle',
    /** A tape's own details screen: see `app/tape.tsx`. */
    details: {
      title: 'Kaset ayrıntıları',
      listening: 'Dinleme',
      heard: 'Dinlenen',
      notBegun: 'Henüz başlanmadı',
      lastHeard: 'En son dinlenme',
      part: 'Parça',
      partOf: (at, of) => `${format.number(of)} parçadan ${format.number(at)}.`,
      speed: 'Hız',
      marks: 'İşaretler',
      source: 'Kaynak',
      from: 'Nereden',
      kinds: { youtube: 'Bir YouTube videosu', playlist: 'Bir YouTube oynatma listesi', podcast: 'Bir podcast bölümü', book: 'LibriVox\'tan bir kitap', byHand: 'Kasetler klasörüne elle kondu' },
      show: 'Program',
      book: 'Kitap',
      channel: 'Kanal',
      list: 'Oynatma listesi',
      published: 'Yayın tarihi',
      fetched: 'İndirilme',
      chapters: 'Bölümler',
      skipped: 'Atlanan kısımlar',
      skippedUnknown: 'Bir sonraki çalışta bakılır',
      skippedOff: 'Kaset ayarlarında kapalı',
      skippedTrouble: 'SponsorBlock\'a ulaşılamadı; bir sonraki çalışta yeniden sorulur',
      skippedNone: 'İşaretli kısım yok',
      skippedSome: (count, seconds) => `${format.number(count)} kısım · ${format.number(seconds)} sn`,
      address: 'Adres',
      listAddress: 'Listenin adresi',
      openSeries: 'Programı aç',
      file: 'Dosya',
      name: 'Ad',
      folder: 'Klasör',
      format: 'Biçim',
      size: 'Boyut',
      megabytes: (mb) => `${format.number(mb)} MB`,
      added: 'Telefona eklenme',
      missing: 'Bu kaset artık kütüphanede değil.',
    },
    seriesHeading: 'Takip ettiklerin',
    singlesHeading: 'Kasetler',
    booksHeading: 'Kitaplar',
    /** The tapes view's filter: all of it, or one of its parts. */
    filter: { all: 'Tümü', series: 'Takip', books: 'Kitaplar', tapes: 'Kasetler' },
    seriesLine: (count, fresh) => `${format.number(count)} bölüm${fresh > 0 ? ` · ${format.number(fresh)} yeni` : ''}`,
    seriesNone: 'Henüz bölüm indirilmedi',
    /** A folder of several tapes as one row: how many parts, and how many of them not begun. */
    bookLine: (count, fresh) => `${format.number(count)} parça${fresh > 0 ? ` · ${format.number(fresh)} başlanmadı` : ''}`,
    count: (count) => `${format.number(count)} kaset`,
    /** Over the tapes view while tapes are being chosen. */
    selected: (count) => `${format.number(count)} kaset seçildi`,
    empty: (folder) => `Sesli kitapları, podcast’leri ve uzun kayıtları kütüphane klasörünün içindeki Tapes klasörüne koy (${folder}). Burada görünürler, kaldığın yerden devam ederler ve müziğine karışmazlar.`,
    markPlayed: 'Dinlendi olarak işaretle',
    markUnplayed: 'Dinlenmedi olarak işaretle',
  },

  nothingMatches: (query) => `“${query}” ile eşleşen bir şey yok.`,
  noAlbums:
    'Henüz albüm yok. Bir albüm ancak parçalarının bilgileri arandıktan sonra görünür; bir dosyanın bulunduğu klasör albüm sayılmaz.',
  back: '‹ Geri',
  trackMenu: 'Parça seçenekleri',
  albumMenu: 'Albüm seçenekleri',

  screen: {
    searchYouTube: (query: string) => `YouTube’da ara: “${query}”`,
    viewSwitch: 'Kütüphane görünümü',
    searchHints: {
      tracks: 'Parça adı, sanatçı ve etiket ara',
      albums: 'Parça adı, sanatçı ve etiket ara',
      artists: 'Sanatçı ara',
      folders: 'Klasör ara',
      tapes: 'Kaset, dizi ve yazar ara',
    },
    sort: 'Sıralama',
    sortShort: { name: 'A–Z', added: 'Eklenme', played: 'Dinlenme', colour: 'Renk' },
    sortedBy: {
      name: 'Ada göre sıralı',
      added: 'Eklenme zamanına göre sıralı',
      played: 'Son dinlenme zamanına göre sıralı',
      colour: 'Kapak rengine göre sıralı',
    },
    sortHint: 'Kütüphanenin sıralamasını değiştirir',
    lookSwitch: 'Bu görünümün diğer düzenine geçer',
    view: 'Görünüm',
    looks: { list: 'Liste', shelves: 'Raflar', rack: 'Raf', map: 'Harita' },
    shelf: { added: 'Son eklenenler', around: (hour: string) => `Saat ${hour} sularında`, repeat: 'Bu ay döne döne dinlenenler', while: 'Bir süredir dinlenmeyenler', never: 'Hiç çalınmayanlar', all: 'Tüm şarkılar', play: (name: string) => `${name} rafını çal`, shuffle: (name: string) => `${name} rafını karışık çal`, queue: (name: string) => `${name} rafını sıraya ekle` },
    artistMap: { drawing: 'Harita çiziliyor…', shuffle: 'Şarkılarını karışık çal', open: 'Aç', with: 'Birlikte', lasso: 'Sanatçıları çevirip karışık çal', lassoHint: 'Karıştırmak istediğin sanatçıların etrafını çiz', lassoChosen: 'Çevrilenler', putBackAll: 'Elle taşınan sanatçıları yerine koy', movedByHand: 'Elle taşınanlar', putBack: 'Yerine koy' },
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
    setAside: { label: 'Kenara ayır', hint: 'Şarkıları Parçalar’dan ve hepsini karıştırmadan çıkar' },
    bringBack: { label: 'Geri getir', hint: 'Şarkıları yeniden Parçalar’da ve karıştırmada' },
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
    quickNext: 'Sonraki',
    quickQueue: 'Sıra',
    quickList: 'Liste',
    playNext: { label: 'Sonraki olarak çal', hint: 'Çalan parçanın hemen ardından' },
    keepListened: { label: 'Kütüphaneye al', hint: 'Kütüphanene kopyalanır, geçmişiyle birlikte' },
    addToQueue: { label: common.addToQueue, hint: 'En sona' },
    playSimilar: { label: 'Benzerleriyle çal', hint: 'Önce bu, sonra bir grup benzer şarkı' },
    playOnly: { label: 'Sadece bunu çal', hint: 'Sırada yalnızca bu şarkı olur' },
    playFromStart: { label: 'Baştan çal', hint: 'Kalınan yer unutulur' },
    series: { label: 'Programı aç', hint: 'Bölümleri ve yenilerinin nasıl indirileceği' },
    tapeFolder: { label: 'Klasörünü aç', hint: 'Bulunduğu klasördeki diğer her şey' },
    tapeDetails: { label: 'Ayrıntıları gör', hint: 'Ne kadar dinlendiği, nereden geldiği ve dosyası' },
    share: { label: 'Paylaş', hint: 'Ses olarak gider: sohbet onu orada çalar' },
    shareFile: { label: 'Dosya olarak paylaş', hint: 'Dosyanın kendisi olarak gider: sohbet onu belge olarak tutar' },
    album: { label: 'Albüme git', hint: 'Albümün geri kalanı, sırasıyla' },
    addToPlaylist: { label: 'Listeye ekle', hint: 'Listelerinden biri ya da yeni bir liste' },
    setAside: { label: 'Kenara ayır', hint: 'Parçalar’dan ve hepsini karıştırmadan çıkar' },
    bringBack: { label: 'Geri getir', hint: 'Yeniden Parçalar’da ve karıştırmada' },
    asideWith: { label: 'Başkalarıyla kenarda', hint: 'Albümü, sanatçısı, klasörü ya da bir etiketiyle: Kenara ayrılanlar’dan geri getirilir' },
    favoriteAdd: { label: "Favorilere ekle", hint: "Kalbin doldurduğu liste, en yeni en üstte" },
    favoriteRemove: { label: "Favorilerden çıkar", hint: "Kalbin doldurduğu listeden çıkar" },
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

  setAside: {
    title: 'Kenara ayrılanlar',
    none: 'Hiçbiri. Parçalar’da ve karıştırmada istemediğin bir albümü, sanatçıyı ya da şarkıyı kenara ayırabilirsin.',
    some: (count) => `${format.number(count)} şarkı kenarda`,
    note: 'Kenara ayrılan bir şarkı Parçalar’da görünmez, hepsini karıştırmaya ve müzik sürsün diye seçilen şarkılara girmez. Albümünde, sanatçısında ve klasöründe, listelerinde ve aramada yerinde durur; bunlardan biri çalınınca çalar. Hiçbir şey silinmez.',
    empty: 'Kenara ayrılan bir şey yok. Kenara ayırmak için bir albüme ya da şarkıya basılı tut, ya da bir sanatçıyı veya klasörü aç.',
    kinds: { album: 'Albümler', artist: 'Sanatçılar', list: 'Listeler', folder: 'Klasörler', tag: 'Etiketler', track: 'Şarkılar' },
    songs: (count) => `${format.number(count)} şarkı`,
    bringBack: 'Geri getir',
    bringBackSpoken: (name) => `${name} geri getir`,
    addTag: 'Bir etiketi kenara ayır',
    noTags: 'Kenara ayrılacak başka etiket yok.',
    album: { set: 'Bu albümü kenara ayır', back: 'Bu albümü geri getir' },
    artist: { set: 'Bu sanatçıyı kenara ayır', back: 'Bu sanatçıyı geri getir' },
    list: { set: 'Bu listeyi kenara ayır', back: 'Bu listeyi geri getir' },
    folder: { set: 'Bu klasörü kenara ayır', back: 'Bu klasörü geri getir' },
  },

  shortFiles: {
    title: 'Kısa dosyaları gizle',
    note: 'Sesli mesajları, zil seslerini ve bildirim seslerini uzunluklarına göre dışarıda bırakır. Hiçbir şey silinmez.',
    under: (seconds) => `${format.number(seconds)} sn altı`,
    shorterThan: (seconds) => `${format.number(seconds)} saniyeden kısa`,
  },

  autoWrite: {
    heading: "Dosyalarda",
    edits: { title: "Kaydettiklerimi dosyaya yaz", note: "Bir şarkının ayrıntılarını tek tek ya da toplu kaydettiğinde, Dosyaya yaz’ın yaptığı gibi dosyaya da yazılır. Jukebox’ın kendi indirmediği dosyalar için Android önce sorar." },
    lookups: { title: "Aramanın bulduklarını dosyaya yaz", note: "Aramanın eşleştirdiği ve senin düzenlemediğin şarkıların ayrıntıları dosyaya yazılır. Jukebox’ın kendi indirdikleri hemen, arka planda bile yazılır. Diğer dosyalar bekler ve uygulama bir sonraki açıldığında hepsi için birlikte sorulur. Çalan şarkı bir sonrakine kalır." },
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

  shuffle: {
    menu: 'Karıştır',
    everything: 'Tüm şarkılar',
    change: 'Düğmenin çaldığını değiştir…',
    heading: 'Karıştır düğmesi şunu çalar',
    note: 'Bir kereliğine başka bir şeyi karıştırmak için düğmeye basılı tut. Widget ve araba da aynısını çalar.',
    labelHeading: 'Karıştır düğmesinde yazan',
    label: { name: 'Çaldığı şeyin adı', words: 'Kendi yazdığın', icon: 'Hiçbir şey, yalnızca simgesi' },
    wordsHeading: 'Karıştır düğmesindeki yazı',
    wordsPlaceholder: 'Karıştır',
    spoken: (name) => `Karıştır: ${name}`,
  },
};
