import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const settings: Strings['settings'] = {
  lastBuilt: (when) => `Son derleme: ${when}`,
  lastBuiltUnknown: 'Son derleme: güncel sürüm yüklendikten sonra görünür',

  sections: {
    app: 'Uygulama',
    library: 'Kütüphane',
    views: 'Kütüphane görünümleri',
    data: 'Verilerin',
    player: 'Oynatıcı',
    experimental: 'Deneysel',
  },

  language: {
    title: 'Dil',
    note: 'Uygulamanın dili. Telefonun dilinden bağımsızdır.',
  },
  theme: {
    title: 'Tema',
    note: 'Sistem seçeneği, telefonun açık ya da koyu tema ayarına uyar.',
  },

  tags: { note: 'Parça bilgileri ve albüm kapakları' },
  rack: {
    title: 'Albümleri raf olarak göster',
    note:
      'Telefonu yan tutarken liste okumak yerine kapakların arasında gezin. Açmak için öndeki kapağa dokun.',
  },
  still: {
    title: 'Animasyonları azalt',
    note:
      'Kare atlayan telefonlar için. Oynatıcı yükselerek açılmak yerine doğrudan belirir, oyun da can kazanıldığında ya da kaybedildiğinde ekranı aydınlatmaz. Tuşlar yine düşer; o süsleme değil, oyunun kendisi.',
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
