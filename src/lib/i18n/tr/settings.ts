import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const settings: Strings['settings'] = {
  lastBuilt: (when) => `Son derleme: ${when}`,
  lastBuiltUnknown: 'Son derleme: güncel sürüm yüklendikten sonra görünür',

  sections: {
    look: 'Görünüm ve his',
    sound: 'Ses',
    player: 'Oynatıcı',
    tapes: 'Kasetler',
    library: 'Kütüphane',
    downloads: 'İndirmeler ve Keşfet',
    data: 'Verilerin',
    views: 'Kütüphane görünümleri',
    experimental: 'Deneysel',
  },
  categories: {
    look: 'Tema, hareket, titreşim ve kütüphanenin sunduğu görünümler.',
    sound: 'Ekolayzer ve efektler, ses düzeyini eşitleme, çapraz geçiş, hız ve perde.',
    player: 'Atlama düğmelerinin süresi, sıra bitince ne çalacağı ve şarkı sözlerinin çevrildiği dil.',
    tapes: 'Akıllı geri sarma, kasetin atlama düğmelerinin süresi ve podcast’leri yalnızca Wi‑Fi’de indirme.',
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
  favoritesShown: { title: "Favoriler", note: "Her zaman duran, en yenisi en üstte bir liste. Oynatıcıdaki kalp ve şarkı menüsündeki Favorilere ekle onu doldurur. Kapalıyken üçü de gizlenir, içindekiler bekler." },
  listButton: {
    title: 'Listeye ekle düğmesi',
    note:
      'Oynatıcıda, çalan şarkıyı menüsüne girmeden listelerinden birine ekleyen bir düğme.',
  },
  autoplaySizes: { title: 'Bir seferde benzer şarkı', library: 'Kütüphanenden', fresh: 'Discover’dan yeni', note: 'Sıra her doldurulduğunda kaç şarkı ekleneceği; “Benzer şarkılarla devam et” ve benzerleriyle çalınan şarkılar için. Her yeni şarkı bir indirme demek. Karışık mod ikisinin dörtte üçünü alır.' },
  tap: {
    title: 'Bir şarkıya dokununca',
    note: 'Tracks’te ya da arama sonuçlarında dokunduğun şarkıdan sonra ne çalacağı.',
    sheetNote: 'Albüm ya da liste üstündeki Play ve Shuffle, Shuffle all ve Discover bundan etkilenmez. Her şarkının menüsünde bir seferlik “Benzerleriyle çal” ve “Sadece bunu çal” var.',
    list: { label: 'Listenin geri kalanı', note: 'Ondan sonraki şarkılar, gösterildikleri sırayla.' },
    shuffled: { label: 'Listenin geri kalanı, karışık', note: 'Önce bu, sonra listedeki diğerleri rastgele sırayla.' },
    similar: { label: 'Benzer şarkılar', note: 'Önce bu, sonra seçtiğin yerden (kütüphanen ya da Discover) bir grup benzer şarkı. Onlardan sonra sıra “Benzer şarkılarla devam et” ayarına göre sürer.' },
    only: { label: 'Sadece o şarkı', note: 'Ardından bir şey çalmaz; “Benzer şarkılarla devam et” eklerse başka.' },
    source: { title: 'Benzer şarkılar nereden', note: 'Dokunduğun şarkıdan sonraki ilk şarkıların nereden geleceği. Onlardan sonrasını “Benzer şarkılarla devam et” belirler.' },
    everywhere: { title: 'Albümlerde ve listelerde de', note: 'Albüm, liste, sanatçı ya da klasör sayfasında bir şarkıya dokununca da. Kapalıyken onlar kendi sıralarıyla çalar.' },
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
    listen: { title: 'Dinlenip saklanmayan şarkılar', note: 'Saklamazsan (kalp, listeye ekleme ya da menüden “Kütüphaneye al”) indirildikten bu kadar gün sonra silinir.', days: (days) => `${format.number(days)} gün`  },
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
  /** What stands where the cover is in the player: Settings → Player. See `ui/coverLook.ts`. */
  /** Settings → Look & feel, under the theme: the row that opens how the player looks. */
  playerLook: { title: 'Oynatıcı görünümü', open: 'Kapağın yerinde ne duracağı ve müzikle ne hareket edeceği.' },
  coverLook: {
    songs: 'Şarkılar',
    tapes: 'Kasetler',
    cover: 'Kapak',
    record: 'Plak',
    cassette: 'Kaset',
    note: 'Oynatıcıda kapağın yerinde ne duracağı. Plak çalarken döner; kaset, bölüm ilerledikçe bandı bir makaradan ötekine sarar. «Animasyonları azalt» açıkken ikisi de durur.',
    tonearm: 'İğne kolu',
    tonearmNote: 'Plağın üstünde bir pikap kolu; şarkı ilerledikçe iğnesi kenardan etikete doğru ilerler.',
    motion: 'Müzikle birlikte',
    none: 'Hiçbiri',
    spectrum: 'Spektrum',
    ripple: 'Dalgalar',
    breathe: 'Nefes',
    scope: 'Osiloskop',
    motionNote: 'Çevresinde müzikle ne hareket edeceği, duyduğunla aynı anda, kulaklıkta da. Yalnızca çalarken ve oynatıcı açıkken.',
    punch: 'Vuruş',
    spectrogram: 'Spektrogram',
    sparks: 'Kıvılcımlar',
    aurora: 'Renk bulutu',
    notes: {
      spectrum: 'Her perdenin ne kadar yüksek olduğunu gösteren çubuklar; plakta etiketin çevresinde ışınlar.',
      ripple: 'Her vuruşta kenardan dışa yayılan halkalar.',
      breathe: 'Müzikle biraz büyür, arkasında bir parıltı.',
      punch: 'Her vuruşta biraz büyüyüp geri oturur.',
      scope: 'Sesin kendi dalga çizgisi.',
      spectrogram: 'Son birkaç saniyenin tüm perdeleri, akıp giderek.',
      sparks: 'Her vuruşta kenarından oynatıcıya saçılan kıvılcımlar.',
      aurora: 'Tüm oynatıcının arkasında kapağın kendi renklerinden bulutlar, her biri sesin bir kısmıyla büyür.',
    },
    beats: 'Vuruşta titreşim',
    beatsNote: 'Oynatıcı açıkken ve müzik çalarken her vuruşta hafif bir titreşim. Titreşim ayarların ne kadar izin veriyorsa o kadar.',
  },
  still: {
    title: 'Animasyonları azalt',
    note:
      'Kare atlayan telefonlar için. Oynatıcı yükselerek açılmak yerine doğrudan belirir, oyun da can kazanıldığında ya da kaybedildiğinde ekranı aydınlatmaz. Tuşlar yine düşer; o süsleme değil, oyunun kendisi.',
  },
  scriptNames: { title: 'Diğer yazılardaki adlar', latin: 'Latin harfleri', original: 'Orijinal', note: 'Bir arama şarkının adını hem kendi yazısıyla (Japonca, Çince, Korece) hem Latin harfleriyle bulduysa kütüphanenin hangisini göstereceği. Bu eklenmeden önce aranmış şarkılar yeniden arandığında dolar.' },
  haptics: {
    title: "Titreşim",
    open: "Uygulama parmağının altında ne kadar ve ne güçte titreşsin.",
    mode: "Titreşim",
    modes: { off: "Kapalı", essential: "Temel", all: "Tamamı", custom: "Özel" },
    modeNotes: {
      off: "Uygulama hiç titreşmez.",
      essential: "Yalnızca en çok şey anlattığı yerlerde: uzun basma, istediğin bir şeyin olup olmadığı ve oyun.",
      all: "Uzun basma ve sürükleme, anahtarlar ve seçimler, kaydırıcı durakları, sonuçlar, oynatıcı düğmeleri ve oyun.",
      custom: "Aşağıdan hangi anların titreşeceğini seç.",
    },
    strength: "Şiddet",
    strengthNote: "Bıraktığında hissedilir. Motoru hafifletilip güçlendirilemeyen telefonlar kendi şiddetinde titreşir.",
    groupsHeading: "Neler titreşsin",
    groups: {
      holds: { title: "Uzun basma ve sürükleme", note: "Uzun basmanın tutması, taşımak için kaldırılan satır, onay kutularında kaydırılan parmak." },
      choices: { title: "Anahtarlar ve seçimler", note: "Anahtarlar, bir seçimin sekmeleri, seçilen bir seçenek." },
      notches: { title: "Duraklar ve adımlar", note: "Normal hız, 0 dB, kaydırıcının ortası, grafiğin sütunları." },
      results: { title: "Sonuçlar", note: "İstediğin şey oldu ya da olmadı: bulundu, yazıldı, eklendi, içe aktarıldı." },
      player: { title: "Oynatıcı düğmeleri", note: "Oynat, atla, tekrarla, kalp, sözlerde bir satıra dokunma." },
      fun: { title: "Oyun ve eğlence", note: "Piano Tiles'ın tuşları ve daha fazlası." },
    },
    phone: "Telefonun kendi ayarlarında dokunma titreşimi kapalıysa uygulama da titreşmez.",
  },
  moreButton: {
    title: 'Satırlarda üç nokta',
    note:
      'Her şarkı ve albüm satırının sonunda durur ve basılı tutunca açılan menünün aynısını açar. Kapalıyken de satıra basılı tutabilirsin.',
  },
  tabs: {
    title: 'Sekmeler',
    searchNote: 'Keşfet ve YouTube indirmeleri bu sekmede; sekme kapanınca onlar da görünmez.',
    aside: 'Kütüphane ve Ayarlar her zaman görünür.',
    names: 'Simgelerin altında adlar',
    namesNote: 'Kapalıyken bar yalnızca simgeleri gösterir ve biraz daha alçak olur. Yatayda hep öyledir.',
  },

  views: {
    notes: {
      tracks: 'Bütün parçalar, her biri bir satırda.',
      albums: 'Etiketlerdeki bilgilere göre bir araya getirilen albümler.',
      artists: 'Şarkılarda adı geçen herkes. İki sanatçılı bir şarkı ikisinin de altında yer alır.',
      folders: 'Dosyaların bulunduğu, kütüphane klasörünün altındaki klasörler.',
      tapes: 'Kütüphane klasöründeki Tapes klasöründen sesli kitaplar, podcast’ler ve uzun kayıtlar; kaldığın yerden devam eder.',
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
      'Dinleme geçmişin, listelerin, etiketlerin, şarkı sözlerin ve ayarların, takip ettiğin podcast\'ler, her kasette kaldığın yer ve koyduğun işaretler; yerini senin seçtiğin tek bir dosyada. Müziğin kendisi dahil değildir.',
    failed: 'Yedek kaydedilemedi.',
  },
  autoBackup: {
    title: 'Otomatik yedekle',
    off: '"Her şeyi dışa aktar" ile aynı dosya, her gün ya da her hafta seçtiğin bir klasöre kendiliğinden kaydedilir.',
    folder: 'Klasör',
    folderUnnamed: 'Seçilen klasör',
    chooseOther: 'Başka bir klasör seç',
    lost: 'Jukebox bu klasöre artık ulaşamıyor: taşınmış ya da silinmiş, veya izin geri alınmış. Yedeklemeye devam etmek için klasörü yeniden seç.',
    chooseAgain: 'Klasörü yeniden seç',
    every: 'Ne sıklıkla',
    daily: 'Her gün',
    weekly: 'Her hafta',
    keep: 'Saklanan yedekler',
    keepNote: (count) =>
      `Klasörde en yeni ${format.number(count)} yedek saklanır, daha eskileri silinir. Klasördeki başka hiçbir şeye dokunulmaz.`,
    last: (when) => `Son yedek: ${when}.`,
    never: 'Henüz yedek alınmadı.',
    failed: 'Son yedek alınamadı. Bir dahaki sefere yeniden denenecek.',
    now: 'Şimdi yedekle',
    made: 'Yedeklendi.',
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
  /** The tape settings, apart from the music's: see `app/settings-tapes.tsx`. */
  tapes: {
    smartRewind: {
      title: 'Akıllı geri sarma',
      note: 'Bir süre sonra yeniden çalınan kaset, bırakıldığı yerin biraz gerisinden başlar; ne kadar uzun ara verildiyse o kadar geriden: kısa bir aradan sonra üç saniye, bir günden sonra yarım dakika. Kapalıyken tam durduğu yerden devam eder.',
    },
    skipSilence: { title: 'Sessizliği atla', note: 'Konuşmadaki duraklamalar atlanır, kaset biraz daha kısa sürer. Müziğe hiç dokunulmaz.' },
    voiceClarity: { title: 'Daha net ses', note: 'Sesin altındaki uğultu kısılır, kelimeleri ayırt ettiren bölüm ekolayzerinin üstüne biraz yükseltilir. Yalnızca kaset çalarken.' },
    skipSponsors: { title: 'Sponsorları atla', note: 'YouTube’dan gelen kasetlerde SponsorBlock dinleyicilerinin işaretlediği bölümler (sponsor mesajı, kanalın kendi reklamı, abone ol çağrısı) geldiğinde atlanır.' },
    back: 'Geri atla',
    forward: 'İleri atla',
    jumpNote: 'Kasette oynat düğmesinin iki yanındaki düğmelerin kaç saniye atladığı. Müziğin kendi ayarı Oynatıcı’da.',
    podcasts: 'Podcast’ler',
    deletePlayed: {
      title: 'Dinlenen bölümleri sil',
      off: 'Takip ettiğin podcast’lerin bölümleri dinledikten sonra da telefonda kalır.',
      after: (days) => `Takip ettiğin bir podcast’in bölümü, uygulama indirdiyse, sonuna kadar dinlendikten ${format.number(days)} gün sonra silinir. İşaret koyduğun bölüm kalır.`,
    },
    /** The podcasts followed, as an OPML file: see `podcasts/opml.ts`. */
    opml: {
      heading: 'Podcast’lerini taşı',
      export: 'Takip ettiğin podcast’leri kaydet',
      exportNote: 'Başka podcast uygulamalarının okuyabildiği bir OPML dosyası olarak.',
      import: 'Dosyadan podcast takip et',
      importNote: 'Başka bir podcast uygulamasından bir OPML dosyası. Programlar takip edilir ama kendiliğinden bir şey indirilmez; bunu her birinin kendi ekranında açabilirsin.',
      importing: (done, total) => `${format.number(total)} programdan ${format.number(done)} okundu…`,
      imported: (followed, already, failed) => [`${format.number(followed)} podcast takip edildi.`, already > 0 ? `${format.number(already)} tanesi zaten takip ediliyordu.` : '', failed > 0 ? `${format.number(failed)} tanesi okunamadı.` : ''].filter(Boolean).join(' '),
      nothing: 'Bu dosyada hiç podcast yok.',
      failed: 'Dosya okunamadı ya da yazılamadı.',
      none: 'Henüz hiçbir podcast’i takip etmiyorsun.',
      saved: (count) => `${format.number(count)} podcast kaydedildi.`,
    },
  },
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
