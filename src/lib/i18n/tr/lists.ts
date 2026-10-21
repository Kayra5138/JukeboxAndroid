import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const lists: Strings['lists'] = {
  naming: {
    heading: 'Listeye ad ver',
    placeholder: 'Liste adı',
    create: 'Oluştur',
  },

  screen: {
    newList: 'Yeni liste',
    fromTag: 'Etiketten',
    empty:
      'Henüz bir şey yok. Liste, senin seçtiğin bir sıradır; etiketlerin tutamadığı tek şey de budur.',
    followingTag: (count, tag) => `${format.number(count)} parça · ${tag} etiketini izler`,
    fromListening: 'Dinlediklerinden',
    discover: 'Keşfet',
    discoverHint: 'Dinlediklerine göre, sende olmayan müzikler',

    tagSheet: {
      heading: 'Etiketten liste oluştur',
      follows: 'Etiketi izler',
      copy: 'Kopya',
      followsHint:
        'Her zaman o etiketi taşıyan ne varsa odur. Sonradan bir şeyi etiketlersen burada görünür; içindekiler yeniden sıralanamaz ve kaldırılamaz.',
      copyHint:
        'Şu anda o etiketi taşıyan ne varsa alır. Sonrasında ikisi kendi yoluna gider, yani listeyi istediğin gibi düzenleyebilirsin.',
      noTags: 'Henüz etiket yok. Önce birkaç parçanın bilgilerini ara.',
    },
  },

  auto: {
    mostPlayed: { name: 'En çok dinlenenler', hint: 'Dönüp dolaşıp geldiklerin' },
    recentlyFound: { name: 'Bu ayın yenileri', hint: 'Ay başından beri ilk kez dinlediklerin' },
    forgotten: {
      name: 'Unutulanlar',
      hint: 'Bir zamanlar çok dinlediğin, yarım yıldır hiç dinlemediklerin',
    },
    skipped: { name: 'En çok atlananlar', hint: 'Hep sonrakine geçtiklerin' },
  },

  picker: {
    heading: (count) => `${format.number(count)} parçanın ekleneceği liste`,
    noLists: 'Henüz liste yok.',
    newList: 'Yeni liste…',
    already: (list) => `Zaten ${list} listesinde`,
    added: (count, list) => `${format.number(count)} parça ${list} listesine eklendi`,
  },

  trackPicker: {
    heading: 'Parça ekle',
    search: 'Kütüphanede ara',
    alreadyHere: 'Zaten bu listede',
    add: (count) => `${format.number(count)} parça ekle`,
  },

  list: {
    album: 'Albüm',
    artist: 'Sanatçı',
    folder: 'Klasör',
    list: 'Liste',

    everythingTagged: (tag) => `${tag} etiketli her şey, şu anki hâliyle`,
    away: (count) => `${format.number(count)} parça daha şu anda kütüphanede değil`,

    addTracks: 'Parça ekle',
    cover: 'Kapak',
    deleteList: 'Listeyi sil',

    albums: 'Albümler',
    tracks: 'Parçalar',
    opensAlbum: 'Albümü açar',

    empty: {
      editable:
        'Burada henüz bir şey yok. Yukarıdan parça ekle ya da kütüphaneden buraya gönder.',
      tag: 'Henüz hiçbir şey bu etiketi taşımıyor. Birkaç parçaya eklersen burada görünürler.',
      album: 'O albüm artık kütüphanede değil.',
      artist: 'Kütüphanede artık ona ait bir şey yok.',
      folder: 'O klasörde artık hiçbir şey yok.',
      auto: 'Henüz buraya girecek bir şey yok. Önce biraz müzik dinle.',
    },

    mightBelong: 'Buraya yakışabilir',
    mightBelongHint:
      'Listenin zaten ağırlık verdiği etiketlere göre seçilir; nadir bir etiket, kütüphanenin yarısının taşıdığı bir etiketten daha çok sayılır.',

    choosePicture: 'Resim seç…',
    firstFour: 'İlk dördünü kullan',

    renameHeading: 'Listeyi yeniden adlandır',
    deleteQuestion: (name) => `“${name}” silinsin mi?`,
    deleteHint: 'Liste silinir. Parçalar telefonda kalır.',
  },

  files: {
    importFiles: 'Çalma listesi içe aktar…',
    exportAll: 'Tüm listeleri dışa aktar…',
    export: 'Dışa aktar…',
    untitled: 'İçe aktarılan liste',
    reading: 'Çalma listeleri okunuyor…',

    conflict: {
      heading: (name) => `“${name}” adında bir liste zaten var`,
      hint: 'Çalma listesi, var olan listenin kapağını koruyarak onun yerine geçebilir ya da ayrı bir liste olarak eklenebilir.',
      replace: 'Yerine geçsin',
      keepBoth: (name) => `“${name}” olarak ekle`,
      skip: 'Bu çalma listesini atla',
    },

    result: {
      heading: 'İçe aktarıldı',
      imported: (name, found, total) =>
        `${name} listesi içe aktarıldı: ${format.number(total)} parçadan ${format.number(found)} tanesi bulundu`,
      repeated: (count) =>
        count === 1
          ? 'Bir parça çalma listesinde iki kez geçiyordu; listede bir kez yer alır.'
          : `${format.number(count)} parça çalma listesinde birden çok kez geçiyordu; listede her biri bir kez yer alır.`,
      showMissing: (count) => `Bulunamayan ${format.number(count)} parçayı göster`,
      hideMissing: 'Gizle',
      reasons: {
        notFound: 'Kütüphanede eşleşen bir şey yok',
        ambiguous: 'Birden çok parça eşleşiyor',
        web: 'Dosya değil, web adresi',
      },
      tooBig: (file) => `${file} bir çalma listesi olamayacak kadar büyük.`,
      unreadable: (file) => `${file} çalma listesi olarak okunamadı.`,
      empty: (file) => `${file} içinde hiçbir şey yok.`,
      skipped: (file) => `${file} atlandı.`,
      encoding: (encoding) => `${encoding} olarak okundu`,
      open: 'Aç',
    },

    exportSheet: {
      heading: 'Çalma listesi olarak dışa aktar',
      headingAll: 'Tüm listeleri dışa aktar',
      phone: 'Telefondaki yollar',
      phoneHint:
        '/storage/emulated/0/Music/… gibi tam yollar; dosya nereye konursa konsun bu telefondaki diğer oynatıcılar anlar.',
      library: 'Kütüphane klasöründen',
      libraryHint:
        'Kütüphane klasörünün içinden başlayan yollar; aynı müziklerin bulunduğu bir bilgisayar için. Dosyayı o klasörün en üstüne koy.',
      save: 'Kaydet…',
      chooseFolder: 'Klasör seç…',
      allHint:
        'Listelerinin her biri için, seçtiğin klasöre birer .m3u8 dosyası. Aynı adda bir dosya zaten varsa üzerine yazılır.',
    },

    saved: (name) => `${name} çalma listesi olarak kaydedildi`,
    savedAll: (count, folder) => `${format.number(count)} liste ${folder} klasörüne kaydedildi`,
    notSaved: (names) => `Kaydedilemedi: ${names}`,
    leftOut: (count) =>
      `${format.number(count)} parça dışarıda kaldı: şu anda kütüphane klasörünün içinde değil.`,
    failed: (reason) => `Yapılamadı: ${reason}`,
  },
};
