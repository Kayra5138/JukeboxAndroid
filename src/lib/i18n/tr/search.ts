import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const search: Strings['search'] = {
  modes: {
    discover: 'Keşfet',
    download: 'İndir',
    videos: 'Videolar',
    playlists: 'Oynatma listeleri',
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
    update: 'YouTube değişti ve Jukebox’ın bu sürümü onu henüz okuyamıyor. Jukebox’ı güncelle.',
    unavailable: 'Bu video ya da oynatma listesi kullanılamıyor. Herkese açık başka bir oynatma listesi ya da arama dene.',
    unreachable: 'YouTube’a ulaşılamadı. Bağlantını kontrol edip yeniden dene.',
    refused: 'YouTube bu isteği tamamlayamadı. Daha sonra yeniden dene ya da başka bir sonuç seç.',
  },
};
