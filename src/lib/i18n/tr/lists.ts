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
};
