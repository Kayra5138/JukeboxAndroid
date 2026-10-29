import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const search: Strings['search'] = {
  modes: {
    discover: 'Keşfet',
    download: 'İndir',
    videos: 'Videolar',
    playlists: 'Oynatma listeleri',
  },

  tapes: {
    intro:
      'YouTube’dan sesli kitaplar, podcast’ler, konuşmalar ve uzun kayıtlar; kütüphanendeki Tapes klasörüne iner ve kaldığın yerden devam eder. Ara ya da bir video veya oynatma listesi bağlantısı yapıştır; takip etmek için bir kanal bağlantısı da olur.',
    placeholder: { videos: 'Başlık, program ya da YouTube bağlantısı', playlist: 'Kitap, dizi ya da oynatma listesi bağlantısı' },
    empty: { videos: 'Bir kitap, program, konuşma ya da ders ara.', playlist: 'Tek kaset olarak indirilecek bir oynatma listesi ara: parça parça bir kitap ya da bir programın bir sezonu.' },
    download: 'Kaset olarak indir',
    downloadBook: (count) => `${format.number(count)} parçanın hepsini tek kaset olarak indir`,
    bookHint: 'Hepsi listenin adını taşıyan tek bir klasöre, listedeki sırayla numaralanarak iner ve arka arkaya çalar.',
    added: (name) => `Tapes/${name} klasörüne iniyor`,
    sources: { youtube: 'YouTube', podcasts: 'Takip et', books: 'Kitaplar', files: 'Telefon' },
    /** Books from the Internet Archive: see `books/archive.ts`, `BooksPane` and the book screen. */
    /** Files on the phone brought into the Tapes folder: see `FilesPane`. */
    files: {
      intro: 'Telefonunda zaten bulunan kitaplar, kayıtlar ve konuşmalar Kasetler’indeki bir klasöre kopyalanır. Seçtiğin dosyalar olduğu yerde kalır.',
      choose: 'Dosya seç',
      chooseOther: 'Başka dosyalar seç',
      folder: 'Klasör adı',
      folderPlaceholder: 'Kitabın ya da kaydın adı',
      folderNote: 'Kütüphanendeki Kasetler klasörüne bu adla, adlarındaki numaraların sırasıyla girer.',
      copy: (count) => count === 1 ? 'Kasetlere kopyala' : `${format.number(count)} dosyayı Kasetlere kopyala`,
      chosen: (count) => `${format.number(count)} dosya seçildi`,
      copied: (done, of) => done === of ? `${format.number(done)} dosya Kasetlerine kopyalandı.` : `${format.number(of)} dosyanın ${format.number(done)} tanesi kopyalandı; diğerleri okunamadı.`,
      failed: 'Dosyaların hiçbiri kopyalanamadı.',
      pickFailed: 'Dosyalar seçilemedi.',
      toTapes: 'Kasetlere git',
    },
    books: {
      intro: 'Telif süresi dolmuş kitaplar; LibriVox gönüllüleri sesli okumuş, Internet Archive’da ücretsiz duruyor. Ad ya da yazara göre ara veya archive.org’daki dinlenecek herhangi bir şeyin adresini yapıştır.',
      placeholder: 'Kitap adı, yazar ya da archive.org bağlantısı',
      nothingFound: 'Kitap bulunamadı.',
      searchFailed: 'Internet Archive’da arama yapılamadı.',
      anyLanguage: 'Tüm diller',
      popular: 'En çok dinlenenler',
      bookFailed: 'Bu kitap Internet Archive’dan okunamadı.',
      stats: (parts, minutes, here) => `${format.number(parts)} bölüm · ${minutes >= 60 ? `${format.number(Math.floor(minutes / 60))} sa ${format.number(minutes % 60)} dk` : `${format.number(minutes)} dk`}${here > 0 ? ` · telefonda ${format.number(here)}` : ''}`,
      fetchAll: 'Kitabın tamamını indir',
      fetchRest: (count) => count === 1 ? 'Son bölümü indir' : `Kalan ${format.number(count)} bölümü indir`,
      size: (mb) => `Toplam yaklaşık ${format.number(mb)} MB`,
      parts: (count) => `${format.number(count)} bölüm`,
    },
    podcasts: {
      intro: 'Bir podcast’i ya da YouTube kanalını takip et, yeni bölümleri kendiliğinden Kasetler’e gelsin; ya da açıp yalnızca istediğin bölümleri indir. Ara ya da bir beslemenin veya kanalın adresini yapıştır.',
      /** Under the button on a show not followed: that its episodes can be had without following it. */
      withoutFollowing: 'Dinlemek için takip etmen gerekmez: aşağıdan istediğin bölümü indir. Takip edersen yenileri kendiliğinden gelir.',
      /** Where podcasts can be had from: said under the intro. */
      /** The title of a followed or followable show's own screen, a podcast or a YouTube channel. */
      showTitle: 'Program',
      sources: 'Nereden: herkese açık beslemesi olan neredeyse her podcast’in bulunduğu Apple podcast dizinindeki programlar (Spotify’da yayımlananların çoğu dahil); Anchor, Buzzsprout, Libsyn, Podbean, SoundCloud gibi her yerden bir besleme adresi; ve YouTube kanalları.',
      placeholder: 'Podcast ya da kanal adı, veya bağlantı',
      searchFailed: 'Podcast aranamadı. Bağlantını kontrol et.',
      feedFailed: 'Bu podcast’in beslemesi okunamadı.',
      notChannel: 'Bu bir YouTube kanalının adresi değil ya da kanal bulunamadı.',
      channelsHeading: 'YouTube kanalları',
      podcastsHeading: 'Podcast\'ler',
      subscribers: (count) => `${format.number(count)} abone`,
      channelsFailed: 'YouTube\'da kanal aranamadı.',
      nothingFound: 'Podcast bulunamadı.',
      yours: 'Podcast’lerin',
      noneYet: 'Henüz hiçbir podcast’i takip etmiyorsun.',
      wifiOnly: 'Yeni bölümler yalnızca Wi‑Fi’de',
      wifiOnlyNote: 'Takip ettiğin podcast’lerin bölümleri kendiliğinden yalnızca Wi‑Fi’de iner. İstediğin bölümü yine elle indirebilirsin.',
      follow: 'Takip et',
      following: 'Takip ediliyor',
      unfollow: 'Takibi bırak',
      autoDownload: 'En yeni bölümleri indir',
      autoDownloadNote: (keep) => keep === 1 ? 'En yeni bölüm indirilmiş tutulur.' : `En yeni ${format.number(keep)} bölüm indirilmiş tutulur.`,
      keep: (count) => format.number(count),
      episodes: (count) => `Bölümler · ${format.number(count)}`,
      noEpisodes: 'Bu beslemede dosyası olan bölüm yok.',
      download: 'İndir',
      continue: 'Devam et',
      start: 'Başla',
      more: 'Devamı',
      less: 'Daha az',
      stats: (total, here) => `${format.number(total)} bölüm · ${format.number(here)} tanesi telefonda`,
      play: 'Çal',
      /** The episodes shown by when they came out: see `podcasts/when.ts`. */
      when: { label: 'Zaman', all: 'Tümü', week: 'Son bir hafta', month: 'Son bir ay', quarter: 'Son 3 ay' },
      newest: 'Önce en yeni',
      oldest: 'Önce en eski',
      noneThen: 'Bu zamandan bölüm yok.',
      fetchNext: 'Sonraki bölümleri indir',
      fetchNextNote: (count) =>
        count === 1 ? 'Eski bir bölümü dinlerken ondan sonraki bölüm indirilir, böylece bu bölüm bittiğinde hazır olur.' : `Eski bir bölümü dinlerken ondan sonraki ${format.number(count)} bölüm indirilir, böylece her bölüm bittiğinde sıradaki hazır olur.`,
      line: (date, length) => [date, length].filter(Boolean).join(' · '),
    },
  },
  unavailable: {
    heading: 'YouTube için uygulamanın yeni sürümü gerekiyor',
    body: 'Müzik aramak ve indirmek için güncel sürümü yükle. Kütüphaneni kullanmaya devam edebilirsin.',
    downloads: 'YouTube’dan indirebilmek için güncel sürümü yükle.',
  },

  intro: {
    videos: 'YouTube’da ara ya da bir video bağlantısı yapıştır. Sesi kütüphanene kaydet.',
    playlist:
      'Bir oynatma listesi ara ya da YouTube bağlantısını yapıştır. Parçalarını görmek ve indirmek için bir sonucu aç. Oynatma listesinin ilk 500 öğesine bakılır.',
  },
  inputLabel: {
    videos: 'YouTube’da ara ya da bir video bağlantısı yapıştır',
    playlist: 'Oynatma listesi adı ya da YouTube bağlantısı',
  },
  placeholder: {
    videos: 'Şarkı, sanatçı ya da YouTube bağlantısı',
    playlist: 'Oynatma listesi adı ya da YouTube bağlantısı',
  },

  formats: { mp3: 'MP3', original: 'Özgün ses' },
  formatHint: {
    mp3: 'İndirildikten sonra MP3’e dönüştürülür.',
    original: 'Mümkün olduğunda kaynağın ses biçimi korunur.',
  },

  searching: 'YouTube’da aranıyor…',
  results: (count) => `Sonuçlar · ${format.number(count)}`,
  empty: {
    none: 'Sonuç bulunamadı. Başka bir arama ya da bağlantı dene.',
    videos: 'İstediğin kaydı bulmak için şarkı ve sanatçı adıyla ara.',
    playlist: 'Oynatma listesi adıyla ara ya da bir oynatma listesi bağlantısı yapıştır.',
  },

  playlist: 'Oynatma listesi',
  openPlaylist: 'Oynatma listesini aç',
  backToResults: 'Sonuçlara dön',
  openPlaylistLabel: (title) => `Oynatma listesini aç: ${title}`,
  downloadLabel: (title) => `İndir: ${title}`,
  download: { mp3: 'MP3 indir', original: 'Sesi indir' },
  adding: 'Ekleniyor…',

  addingPlaylist: 'Oynatma listesi ekleniyor…',
  downloadListed: {
    mp3: 'Listelenen parçaları indir · MP3',
    original: 'Listelenen parçaları indir · Özgün ses',
  },
  listedHint:
    'Daha önce indirilmiş ya da kuyruğa alınmış parçalar atlanır. Gizli, silinmiş ve canlı videolar kullanılamayabilir.',
  listCreated: (name) => `Liste oluşturuldu: ${name}. İndirilen parçalar Listeler’de görünecek.`,
  inLibrary: 'Kütüphanende',
  alreadyHave: (count) => `${format.number(count)} şarkı zaten kütüphanendeydi, yeniden indirilmedi.`,
  unnamedPlaylist: 'YouTube oynatma listesi',

  jobLine: (status, mp3) => `${status} · ${mp3 ? 'MP3' : 'Özgün'}`,

  status: {
    finding: 'YouTube’da aranıyor',
    queued: 'Kuyrukta',
    preparing: 'Hazırlanıyor…',
    downloading: (percent) => `İndiriliyor · %${percent}`,
    converting: 'Ses dönüştürülüyor…',
    saving: 'Kütüphaneye ekleniyor…',
    cancelling: 'İptal ediliyor…',
    cancelled: 'İptal edildi',
    failed: 'İndirme başarısız',
    done: 'Kütüphanede',
    missing: 'Dosya kaldırılmış',
  },

  failed: {
    search: 'Arama başarısız oldu. Lütfen yeniden dene.',
    queue: 'İndirme kuyruğa alınamadı.',
    queuePlaylist: 'Oynatma listesi kuyruğa alınamadı.',
    cancel: 'İndirme iptal edilemedi.',
    read: 'İndirmeler okunamadı.',
    readReopen: 'İndirmeler okunamadı. Lütfen Ara sekmesini yeniden aç.',
  },

  errors: {
    playlistLink: 'Bir YouTube oynatma listesi bağlantısı yapıştır ya da oynatma listesi adıyla ara.',
    videoLink: 'Bir şarkı adı ya da geçerli bir YouTube video bağlantısı gir.',
    queueFull: 'İndirme kuyruğu dolu. Birkaç parçanın bitmesini bekleyip yeniden dene.',
    update: 'YouTube değişti ve bu sürümdeki indirici onu henüz okuyamıyor. İndirmeler’den yenisine bak ya da Jukebox’ı güncelle.',
    unavailable: 'Bu video ya da oynatma listesi kullanılamıyor. Herkese açık başka bir oynatma listesi ya da arama dene.',
    unreachable: 'YouTube’a ulaşılamadı. Bağlantını kontrol edip yeniden dene.',
    refused: 'YouTube bu isteği tamamlayamadı. Daha sonra yeniden dene ya da başka bir sonuç seç.',
  },
};
