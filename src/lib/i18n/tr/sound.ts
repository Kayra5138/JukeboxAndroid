import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const sound: Strings['sound'] = {
  // Turkish writes the sign first: %50.
  percent: (value) => `%${format.number(value)}`,

  effects: {
    failures: {
      unsupported: 'Efektleri kullanmak için güncel sürümü yükle.',
      unreadable: 'Efektler okunamadı. Yeniden denenene kadar kapalı kalır.',
      unsent: 'Bu ayar oynatıcıya ulaşmadı.',
    },
    title: 'Efektler',
    presets: {
      off: { name: 'Kapalı', hint: 'Kayıt olduğu gibi' },
      mono: { name: 'Mono', hint: 'İki kulakta da aynı ses — tek kulaklıkla dinlemek için' },
      wide: { name: 'Geniş', hint: 'Yanlar dışa doğru açılır' },
      headphones: {
        name: 'Kulaklık',
        hint: 'Tamamen bir yana yatırılmış miksleri kafanın içinden çıkarır',
      },
      '8d': { name: '8D', hint: 'Ses çevrende yavaşça döner' },
      karaoke: { name: 'Karaoke gibi', hint: 'Ortadaki sesi geriye iter' },
    },
    voices: {
      off: { name: 'Kapalı', hint: 'Kayıt olduğu gibi' },
      robot: { name: 'Robot', hint: 'Pes bir tonla çınlatılır — metalik, çan gibi' },
      vintage: { name: 'Nostaljik', hint: 'Daha az bit, daha kaba bir saat, tizler de kırpılmış' },
      swirl: { name: 'Girdap', hint: 'Üzerinden geçen bir jet gibi, ağır bir süpürme' },
      chipmunk: { name: 'Sincap', hint: 'Beşli kadar yukarıda, süre aynı kalır' },
      squeak: { name: 'Daha da sincap', hint: 'Tam bir oktav; artık ses olmaktan çıkar' },
    },
    ownSettings: 'Kendi ayarların',
    howMuch: 'Miktar',
    voiceNote:
      'Bu seslerin her biri kaydın kendi armoniklerini koruyup değiştirir; altta şarkı yine aynı şarkıdır. Kaydın aslını daha çok duymak için miktarı azalt.',

    stereo: 'Stereo',
    width: 'Genişlik',
    mono: 'Mono',
    asRecorded: 'Kayıttaki gibi',
    balance: 'Denge',
    centre: 'Orta',
    left: (percent) => `%${percent} sol`,
    right: (percent) => `%${percent} sağ`,
    swap: { title: 'Kanalları değiştir', note: 'Sol sağ olur. Ters bağlanmış bir kablo için.' },

    headphones: 'Kulaklık',
    crossfeed: 'Crossfeed',
    crossfeedNote:
      'Her kanalın birazı, hoparlörden dinlerken olduğu gibi gecikmiş ve boğuk olarak öbür kulağa ulaşır. Tamamen bir yana yatırılmış eski mikslerin yorgunluğunu alır. Hoparlörde kayda değer bir etkisi olmaz.',

    rotation: 'Döndürme',
    depth: 'Derinlik',
    turnTakes: 'Bir tur süresi',
    seconds: (count) => `${count} sn`,
    rotationNote:
      '8D denen şey: ses çevrende yavaşça döner. Kulaklık içindir — hoparlörde yalnızca ses düzeyi bir artıp bir azalır.',

    level: 'Seviye',
    preamp: 'Ön amfi',
    decibels: (value) => `${value > 0 ? '+' : ''}${format.decimal(value, 1)} dB`,
    levelNote:
      'Genişletme ya da ekolayzer cızırtı yapıyorsa bunu kıs: o ses, en yüksek tepelere yer kalmadığını gösterir.',
  },

  transitions: {
    missing: 'Uygulamanın bu sürümünde geçişler henüz yok.',
    title: 'Çapraz geçiş',
    about: 'Sonraki parça başlarken önceki çalmayı sürdürür; arada duyulacak bir ek yeri kalmaz.',
    betweenTracks: 'Parçalar arasında',
    overlap: 'Bindirme',
    overlapNote:
      'Sonraki parçanın, biten parçanın ne kadarının üzerine bineceği. Sıfırda parçalar her zamanki gibi biter.',
    albums: {
      title: 'Albümleri bir arada tut',
      note:
        'Aynı albümün art arda gelen parçaları arasında çapraz geçiş yapılmaz. Konser kayıtlarında ve kesintisiz akacak şekilde mikslenmiş albümlerde o geçiş bilerek öyle bırakılmıştır.',
    },
    others: {
      manualMs: {
        label: 'Parça atlama',
        hint:
          'Sonraki ya da önceki düğmesine basıldığında. Kısa tut — geç tepki veren düğme, bastığın düğme gibi gelmez.',
      },
      pauseMs: {
        label: 'Duraklatma ve sürdürme',
        hint: 'Durmanın ve yeniden başlamanın sertliğini alır.',
      },
      seekMs: {
        label: 'İleri geri sarma',
        hint:
          'İlerleme çubuğu sürüklendikten sonra. Yoksa dalganın ortasına denk gelir ve çıtırtı duyulur.',
      },
    },
    equalPower: {
      title: 'Eşit güç eğrisi',
      note:
        'Yarı seviyedeki iki parça birlikte yarı yükseklikte duyulmaz. Bu eğri bindirme boyunca seviyeyi korur; düz olanı ortada çöker.',
    },
    fewer: 'Daha az ayar',
    more: 'Diğer geçişler',
    reset: 'Varsayılanlara dön',
    seconds: (written) => `${written} sn`,
  },

  equalizer: {
    missing: 'Uygulamanın bu sürümünde ekolayzer henüz yok.',
    title: 'Ekolayzer',
    attached: 'Şu anda çalanı biçimlendiriyor.',
    saved: 'Kaydedildi; bir şey çalmaya başladığı anda uygulanır.',
    carried:
      'Telefonun kendi ekolayzerinde ayarlı olan eğri buraya aktarıldı ve Ön ayarlar altında “Telefonun ekolayzeri” adıyla duruyor. Aynı biçim bu ekolayzerin bantlarıyla kuruldu; artık yükselttiği yerler için kendine pay bıraktığından eskisinden biraz daha kısık duyulabilir.',
    lost:
      'Telefonun kendi ekolayzerinde ayarlı olan eğri aktarılamadı: bantları frekanslarla eşleştirilemedi. Bu ekolayzer düz başlıyor.',

    presets: 'Ön ayarlar',
    saveAs: 'Farklı kaydet…',
    rename: 'Yeniden adlandır…',
    confirmDelete: (name) => `“${name}” silinsin mi?`,
    importAutoEq: 'AutoEQ içe aktar…',
    keptAs: (name) => `“${name}” adıyla kaydedildi.`,
    renamedTo: (name) => `Adı “${name}” olarak değiştirildi.`,

    bands: 'Bantlar',
    noBands:
      'Hiç bant yok, yani eğri düz: müzik kaydedildiği gibi. Bir bant ekle, bir ön ayar seç ya da kulaklığın için bir düzeltme içe aktar.',
    addBand: 'Bant ekle',
    full: (most) => `En fazla ${most} bant için yer var.`,

    preamp: 'Ön amfi',
    automatic: 'Otomatik',
    byHand: 'Elle ayarla',
    nothingBoosted: 'Hiçbir şey yükseltilmediği için yer açmak üzere kısılan bir şey de yok.',
    turnedDown: (by) =>
      `Her şey ${by} kısılıyor; bu, eğrinin en yüksek noktasının yükselttiği kadardır. Yükseltmenin kırpılmaması için bu kadar pay gerekir.`,
    typeIt: (now) => `Elle yaz · ${now}`,
    typePreamp: (now) => `Ön amfiyi elle yaz, şu an ${now}`,
    clipsAbove: (level) =>
      `${level} değerinin üzerinde en yüksek sesli bölümler kırpılabilir; bu, sesin bozulması olarak duyulur.`,
    lowEnough: 'Bu eğrinin yükselttiği hiçbir şeyin kırpılmayacağı kadar düşük.',

    unbuilt:
      'Uygulamanın bu sürümü hâlâ telefonun kendi ekolayzeri üzerinden çalıyor; bu ekran artık onu ayarlamıyor. Bantlar bir sonraki sürümle gelecek; aşağıdaki ayarlar eskisi gibi çalışır.',

    tone: 'Ton',
    bassBoost: 'Bas güçlendirme',
    surround: 'Surround',
    loudness: 'Ses yüksekliği',
    toneNote:
      'Bu üçü telefonun kendi efektleridir ve bantlardan sonra uygulanır. Ses yüksekliği, kısık bir kaydı tonuna dokunmadan yükseltir. Fazla açılırsa kırpılır; bu, yüksek sesli bölümlerin bozulması olarak duyulur.',
    resetAll: 'Her şeyi sıfırla',

    prompt: {
      keepCurveAs: 'Bu eğriyi şu adla kaydet',
      keepCorrectionAs: 'Bu düzeltmeyi şu adla kaydet',
      namePlaceholder: 'Bir ad; örneğin hangi kulaklık için olduğu',
      keep: 'Kaydet',
      aName: 'Bir ad',
      set: 'Ayarla',
      preampHint: (least, most) => `Desibel olarak, ${least} ile ${most} arasında.`,
      frequency: (band) => `${band}. bant frekansı`,
      frequencyHint: (least, most) =>
        `Hertz olarak, ${least} ile ${most} arasında. 1,2k yazarsan 1200 sayılır.`,
      gain: (band) => `${band}. bant kazancı`,
      gainHint: (most) => `Desibel olarak, -${most} ile ${most} arasında.`,
      q: (band) => `${band}. bant Q değeri`,
      qHint: (least, most) => `${format.decimal(least, 1)} ile ${most} arasında.`,
    },
  },

  presets: {
    builtIn: {
      Flat: 'Düz',
      'More bass': 'Daha çok bas',
      'Less boom': 'Daha az uğultu',
      Warm: 'Sıcak',
      'Voices forward': 'Vokaller önde',
      'More air': 'Daha ferah',
      'Quiet listening': 'Kısık sesle dinleme',
    },
    myCurve: 'Eğrim',
  },

  band: {
    types: { peak: 'Tepe', lowShelf: 'Alçak raf', highShelf: 'Yüksek raf' },
    said: (band, type, frequency, gain, q) => `${band}. bant: ${type}, ${frequency}, ${gain}, Q ${q}`,
    closes: 'Bu bandı kapatır',
    opens: 'Bu bandı değiştirmek üzere açar',
    kind: (band, type) => `${band}. bant türü: ${type}`,
    frequency: 'Frekans',
    gain: 'Kazanç',
    widthQ: 'Genişlik (Q)',
    cornerQ: 'Köşe (Q)',
    peakHint:
      'Q yükseldikçe bant daralır: 1 bir oktavdan biraz fazladır, 10 ise tek bir nota kadar.',
    shelfHint:
      'Raf, frekansının bir yanında kalan her şeyi yükseltir ya da kısar. Q köşenin ne kadar keskin olduğudur; alışılmış değer 0,7’dir.',
    typeIt: 'Elle yaz',
    typeFrequency: (band, now) => `${band}. bandın frekansını elle yaz, şu an ${now}`,
    typeGain: (band, now) => `${band}. bandın kazancını elle yaz, şu an ${now}`,
    typeQ: (band, now) => `${band}. bandın Q değerini elle yaz, şu an ${now}`,
    remove: (band) => `${band}. bandı kaldır`,
    removeThis: 'Bu bandı kaldır',
  },

  curve: {
    label: (said) => `Frekans yanıtı eğrisi. ${said}`,
    flat: 'Düz: hiçbir şey yükseltilmiyor ya da kısılmıyor.',
    highest: (level, near) => `En yüksek nokta ${near} civarında, ${level}.`,
    lowest: (level, near) => `En düşük nokta ${near} civarında, ${level}.`,
    highestAndLowest: (high, highNear, low, lowNear) =>
      `En yüksek nokta ${highNear} civarında, ${high}; en düşük nokta ${lowNear} civarında, ${low}.`,
  },

  autoEq: {
    title: 'AutoEQ dosyasından içe aktar',
    about: 'Bir kulaklığın ParametricEQ.txt dosyasının içeriğini yapıştır ya da dosyayı seç.',
    textLabel: 'ParametricEQ dosyasının metni',
    chooseFile: 'Dosya seç…',

    graphic:
      'Bu, başka türde bir ekolayzer için olan GraphicEQ dosyası. Kullanılması gereken ParametricEQ.txt dosyasıdır.',
    noneSupported: 'Bu metindeki filtrelerin hiçbiri bu ekolayzerde bulunan türden değil.',
    noneFound:
      'Bu metinde filtre bulunamadı. Bir satır şöyle görünmelidir: "Filter 1: ON PK Fc 105 Hz Gain -3.4 dB Q 0.70".',
    imported: (count) => `${count} bant içe aktarıldı.`,
    leftOut: (count, room) => `${count} bant daha dışarıda bırakıldı: ${room} bant için yer var.`,
    unsupported: (count) =>
      `${count} filtre bu ekolayzerde bulunmayan bir türden olduğu için atlandı.`,
    adjusted: (count) =>
      `${count} bant, bir bandın ayarlanabileceği sınırların dışındaydı ve sınırların içine çekildi.`,
  },
};
