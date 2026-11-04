import type { Strings } from '../en/index.ts';
import { format } from './format.ts';

export const welcome: Strings['welcome'] = {
  language: {
    heading: 'Dilini seç',
    note: 'İstediğin zaman Ayarlar’dan değiştirebilirsin.',
    go: 'Devam',
    made:
      'Jukebox’ı tek bir kişi geliştiriyor. İngilizce dışındaki diller yapay zekâ tarafından çevrildi ve henüz o dilleri konuşan biri tarafından kontrol edilmedi. Yanlış görünen bir şey olursa GitHub’da bildirebilirsin.',
  },

  setup: {
    step: (at: number, of: number) =>
      `Adım ${format.number(at)}/${format.number(of)}`,
    skip: 'Atla',
    skipHint: 'Kalanını olduğu gibi bırakır ve Jukebox’ı açar',
    back: 'Geri',
    next: 'Devam',
    done: 'Bitti',
    update:
      'Bu sürümde birkaç yeni ayar var. İstediğin zaman Ayarlar’dan değiştirebilirsin.',
    folder: {
      heading: "Müzik klasörün",
      note: "Jukebox’ın müziğini hangi klasörden okuyacağı ve indirdiklerini nereye kaydedeceği.",
      jukebox: { label: (folder: string) => `Jukebox'ın kendi klasörü (${folder})`, note: "Yalnızca bu klasördekiler. İndirilenler buraya kaydedilir; diğer uygulamaların Music’te tuttuğu müzikler dışarıda kalır." },
      music: { label: (folder: string) => `Music'in tamamı (${folder})`, note: "Music klasöründeki ve içindeki klasörlerdeki her şey, eskisi gibi." },
      current: "Daha önce seçilen klasör.",
      songs: (count: number) => `${format.number(count)} şarkı`,
      more: "İstediğin zaman Ayarlar → Kütüphane → Kütüphane klasörü’nden değiştirilebilir; orada başka bir klasör de seçilebilir.",
    },
    look: {
      heading: 'Görünümü seç',
      note: 'Denemek için birine dokun.',
      more:
        'Diğer temalar ve telefonu takip ederken hangi ikisinin kullanılacağı Ayarlar → Görünüm ve his’te.',
    },
    views: {
      heading: 'Kütüphanede neler olsun',
      note: 'Müziğine bakmanın yolları; kütüphanenin üstünde bir düğme olarak durur. İstediklerini aç.',
      more: 'Bunları istediğin zaman Ayarlar → Görünüm ve his’ten değiştirebilirsin.',
    },
    discover: {
      heading: 'Keşfet',
      note:
        'Keşfet, kütüphanendeki sanatçılardan ve onlara benzeyenlerden henüz sende olmayan şarkılar bulur; dinlediğinde onları YouTube’dan indirir.',
      more:
        'Listenin uzunluğu, ne sıklıkla yenileneceği ve dahası Keşfet ayarlarında.',
    },
  },

  offer: {
    heading: 'Kapaklar ve bilgiler bulunsun mu?',
    body: (count) =>
      `Şarkılarından ${format.number(count)} tanesi henüz aranmadı. Jukebox bunların kapaklarını, sanatçılarını ve albümlerini MusicBrainz’de ve Apple’ın iTunes kataloğunda bulabilir.`,
    privacy:
      'Bu ikisine yalnızca şarkıların adları gönderilir, başka hiçbir şey gönderilmez. Sen dinlerken arka planda çalışır; istersen sonra Ayarlar → Kütüphane → Etiketler’den de yapabilirsin.',
    accept: 'Bul',
    decline: 'Şimdi değil',
  },

  progress: {
    starting: 'Kapaklar ve bilgiler aranıyor…',
    counting: (done, total) =>
      `Kapaklar ve bilgiler aranıyor · ${format.number(total)} parçadan ${format.number(done)} tanesi tamam`,
    album: (album, done, total) =>
      `“${album}” aranıyor · ${format.number(total)} parçadan ${format.number(done)} tanesi tamam`,
    covers: (done, total) =>
      `Kapaklar aranıyor · ${format.number(total)} parçadan ${format.number(done)} tanesi tamam`,
    lyrics: (done, total) =>
      `Sözler aranıyor · ${format.number(total)} parçadan ${format.number(done)} tanesi tamam`,
    hint: 'Aramanın izlenip durdurulabileceği Etiketler ekranını açar',
  },

  tips: {
    library:
      'Bir şarkıya basılı tut, parmağının altında bir halka açılır: bir dilime kaydır ve bırak. Kıpırdatmadan bırakırsan menünün tamamı açılır, piyano karoları da orada. Sıradaki olarak çalmak için şarkıyı sağa, kuyruğa eklemek için sola çek.',
    player:
      'Kontrollerin altındaki sözler düğmesi, şarkı çalarken sözleri gösterir; sözler açılınca yanında beliren düğme onları çevirir. Dişli simgesinde hız ve perde, efektler ve uyku zamanlayıcısı var.',
    discover:
      'Keşfet, sende henüz olmayan şarkıları bulur. Bir süre dinleyene kadar kütüphanende en çok şarkısı olan sanatçılardan yola çıkar ve dinlediklerinden öğrenir.',
    dismiss: 'Anladım',
    dismissHint: 'Bu ipucunu bir daha göstermez',
  },

  settings: {
    title: 'İlk açılış',
    note:
      'Jukebox’ı kurulduğu gündeki gibi gösterir: ilk ayarlar, kapakları bulma önerisi ve ipuçları. Müziğin, listelerin ve ayarların olduğu gibi kalır.',
    again: 'Yeniden göster',
  },

  discoverEarly:
    'Henüz pek bir şey dinlenmediyse Keşfet, en çok şarkısı olan sanatçılarından yola çıkar ve dinlediklerinden öğrenir.',
};
