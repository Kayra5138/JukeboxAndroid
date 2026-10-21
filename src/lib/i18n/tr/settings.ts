import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const settings: Strings['settings'] = {
  lastBuilt: (when) => `Son derleme: ${when}`,
  lastBuiltUnknown: 'Son derleme: güncel sürüm yüklendikten sonra görünür',

  sections: {
    look: 'Görünüm',
    sound: 'Ses',
    player: 'Oynatıcı',
    library: 'Kütüphane',
    downloads: 'İndirmeler ve Keşfet',
    data: 'Verilerin',
    views: 'Kütüphane görünümleri',
    experimental: 'Deneysel',
  },
  categories: {
    look: 'Tema, albümlerin raf görünümü, hareket ve kütüphanenin sunduğu görünümler.',
    sound: 'Ekolayzer ve efektler, ses düzeyini eşitleme, çapraz geçiş, hız ve perde.',
    player: 'Atlama düğmelerinin süresi, sıra bitince ne çalacağı ve şarkı sözlerinin çevrildiği dil.',
    library: 'Müziğinin bulunduğu klasör, etiketler ve kapaklar, aynı şarkı olabilecek dosyalar.',
    waiting: (count) => `${format.number(count)} karar bekliyor`,
    downloads: 'İndirme kuyruğu ve yüzen düğmesi, Keşfet ve YouTube indiricisini güncel tutma.',
    data: 'Her şeyi yedekle ya da bir yedeği içe aktar; yeni sürüm denetimi ve ListenBrainz (deneysel).',
  },

  language: {
    title: 'Dil',
    note: 'Uygulamanın dili. Telefonun dilinden bağımsızdır.',
  },
  theme: {
    title: 'Tema',
    open: 'Renkler, cam ya da kendi yaptığın bir tema.',
    note: 'Sistem seçeneği, telefonun açık ya da koyu tema ayarına uyar.',
    pair: {
      light: 'Açık modda',
      dark: 'Koyu modda',
      note: 'Sistem seçiliyken, telefon mod değiştirdikçe bu iki tema arasında geçilir.',
    },
    shuffle: {
      title: 'Her açılışta farklı tema',
      on: 'Açık',
      toggle: 'Uygulama her açıldığında seçilenlerden rastgele birini kullan',
      note: 'Aralarından seçilecek temaları işaretle. Seçilen tema, uygulama bir sonraki açılışa kadar kullanılır; bu arada temayı elle de değiştirebilirsin.',
      empty: 'Bunun bir işe yaraması için en az bir tema işaretle.',
    },
  },
  customTheme: {
    open: 'Özel tema renkleri',
    openNote: 'Özel tema için bir arka plan ve bir vurgu rengi seç. Gerisi bunlardan hesaplanır.',
    preview: 'Önizleme',
    background: 'Arka plan',
    accent: 'Vurgu',
    surface: 'Kartlar',
    automatic: 'Otomatik',
    automaticNote: 'Arka plandan hesaplanır',
    presets: 'Önerilen renkler',
    hue: 'Ton',
    saturation: 'Doygunluk',
    lightness: 'Açıklık',
    degrees: (value) => `${value}°`,
    percent: (value) => `%${value}`,
    hex: 'Renk kodu',
    nudged: (colour) => `Üzerindeki her şey okunabilsin diye ${colour} olarak gösteriliyor.`,
    note:
      'Yazı renkleri, her zaman okunabilsin diye bu renklerden hesaplanır. Seçtiğin bir renk de aynı nedenle biraz açılabilir ya da koyulaşabilir.',
    use: 'Bu temayı kullan',
    reset: 'Sıfırla',
    sample: {
      title: 'Şarkı adı',
      line: 'Sanatçı · Albüm',
      chip: 'Karıştır',
      button: 'Çal',
    },
  },

  tags: { note: 'Parça bilgileri ve albüm kapakları' },
  rack: {
    title: 'Albümleri raf olarak göster',
    note:
      'Telefonu yan tutarken liste okumak yerine kapakların arasında gezin. Açmak için öndeki kapağa dokun.',
  },
  heart: { title: 'Kalp', note: 'Oynatıcıda bir kalp. Hiçbir şey kaydetmez.' },
  listButton: {
    title: 'Listeye ekle düğmesi',
    note:
      'Oynatıcıda, çalan şarkıyı menüsüne girmeden listelerinden birine ekleyen bir düğme.',
  },
  autoplay: {
    title: 'Benzer şarkılarla devam et',
    note: 'Sıra bitmek üzereyken, dinlediklerine benzeyen şarkılar sıranın sonuna eklenir.',
    sheetNote: 'Şarkılar sıra bitmeden birkaç şarkı önce eklenir; ekran kilitli olsa da sıradaki diğer şarkılar gibi çalar. Tekrarlama açıkken hiç eklenmez.',
    off: {
      label: 'Kapalı',
      note: 'Hiçbir şey eklenmez; sıra bitince müzik durur.',
    },
    library: {
      label: 'Kütüphanenden',
      note: 'Etiketlere, sanatçılara ve birlikte dinlediklerine göre seçilir. İnternet gerekmez.',
    },
    fresh: {
      label: 'Yeni şarkılar',
      note: 'Henüz sende olmayan şarkıları Keşfet bulur. Keşfet gibi interneti ve YouTube indirmesini kullanır, onun Wi-Fi ayarına uyar.',
    },
    mixed: {
      label: 'Karışık',
      note: 'Kütüphanenden iki şarkı, ardından bir yeni şarkı. Yeniler Keşfet gibi interneti ve YouTube indirmesini kullanır, onun Wi-Fi ayarına uyar.',
    },
  },
  downloads: {
    note: 'İndirilmekte olanlar, sırada bekleyenler ve tamamlananlar.',
    button: {
      title: 'Yüzen indirmeler düğmesi',
      note: 'Bir şey indirilirken ve bittikten sonra birkaç dakika boyunca uygulamanın üzerinde duran yuvarlak bir düğme. Ne durumda olduğunu görmek için dokun.',
    },
    check: {
      title: 'Yeni YouTube indiricisine bak',
      note: 'Jukebox günde en çok bir kez, yalnızca İndirmeler’i açtığında ya da bir şey indirdiğinde GitHub’a en yeni yt-dlp sürümünü sorar. Senin ya da kütüphanen hakkında hiçbir şey gönderilmez; sen söylemeden de hiçbir şey indirilmez.',
    },
  },
  discover: { note: 'Listenin uzunluğu, ne sıklıkla yenilendiği ve hariç tutulanlar.' },
  still: {
    title: 'Animasyonları azalt',
    note:
      'Kare atlayan telefonlar için. Oynatıcı yükselerek açılmak yerine doğrudan belirir, oyun da can kazanıldığında ya da kaybedildiğinde ekranı aydınlatmaz. Tuşlar yine düşer; o süsleme değil, oyunun kendisi.',
  },
  moreButton: {
    title: 'Satırlarda üç nokta',
    note:
      'Her şarkı satırının sonunda durur ve basılı tutunca açılan menünün aynısını açar. Kapalıyken de satıra basılı tutabilirsin.',
  },
  tabs: {
    title: 'Sekmeler',
    searchNote: 'Keşfet ve YouTube indirmeleri bu sekmede; sekme kapanınca onlar da görünmez.',
    aside: 'Kütüphane ve Ayarlar her zaman görünür.',
  },

  views: {
    notes: {
      tracks: 'Bütün parçalar, her biri bir satırda.',
      albums: 'Etiketlerdeki bilgilere göre bir araya getirilen albümler.',
      artists: 'Şarkılarda adı geçen herkes. İki sanatçılı bir şarkı ikisinin de altında yer alır.',
      folders: 'Dosyaların bulunduğu, kütüphane klasörünün altındaki klasörler.',
    },
    onlyHint: 'Açık kalan tek görünüm olduğu için kapatılamaz',
    toggleHint: 'Bu görünümü kütüphanede gösterir ya da gizler',
    asideOne:
      'Yalnızca bir görünüm açıkken kütüphane onu gösterir ve görünüm seçici olmaz. Biri her zaman açık kalır.',
    asideMany: 'Kütüphanedeki görünüm seçici, açık olanları sunar. Biri her zaman açık kalır.',
  },

  sameSong: {
    note: (count) =>
      `Daha önce başka bir dosya olarak eklediğin bir şarkıya benzeyen ${format.number(count)} dosya var. Sen karar verene kadar geçmişi ayrı tutulur.`,
  },
  exportAll: {
    title: 'Her şeyi dışa aktar',
    note:
      'Dinleme geçmişin, listelerin, etiketlerin, şarkı sözlerin ve ayarların; yerini senin seçtiğin tek bir dosyada. Müziğin kendisi dahil değildir.',
    failed: 'Yedek kaydedilemedi.',
  },
  importBackup: {
    title: 'İçe aktar',
    note:
      'Bir yedeği geri yükle. Önce içinde ne olduğu gösterilir, herhangi bir şey değişmeden önce de sana sorulur.',
    failed: 'İçe aktarma başarısız oldu.',
    refused: (reason) => `${reason} Bu telefonda hiçbir şey değişmedi.`,
  },

  playback: {
    title: 'Oynatma',
    note: (speed) => `Hız ve perde · ${speed}×`,
  },
  equalizer: { note: 'Bantlar, bas, surround ve ses yüksekliği' },
  effects: { note: 'Genişlik, crossfeed, döndürme ve seviye' },
  jump: {
    title: 'Atlama süresi',
    note: 'Çal düğmesinin iki yanındaki düğmelerin parçada kaç saniye ileri ya da geri gittiği.',
  },
  crossfade: { note: 'Bir parçanın yerini sonrakine nasıl bıraktığı' },
  loudness: {
    title: 'Ses düzeyini dengele',
    note:
      'Kısık parçalar yükseltilir, yüksek olanlar kısılır. Sırayla çalınan bir albümde sessiz ve gürültülü bölümler olduğu gibi kalır.',
  },
  lyricsLanguage: {
    title: 'Şarkı sözü çeviri dili',
    note:
      'Şarkı sözleri telefonda çevrilir. İngilizce dışındaki diller için çeviri İngilizce üzerinden yapılır ve ilk seferde ikinci bir model indirilir.',
  },
};
