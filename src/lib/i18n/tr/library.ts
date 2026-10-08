import { common } from './common.ts';
import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const library: Strings['library'] = {
  views: {
    tracks: 'Parçalar',
    albums: 'Albümler',
    artists: 'Sanatçılar',
    folders: 'Klasörler',
  },

  nothingMatches: (query) => `“${query}” ile eşleşen bir şey yok.`,
  noAlbums:
    'Henüz albüm yok. Bir albüm ancak parçalarının bilgileri arandıktan sonra görünür; bir dosyanın bulunduğu klasör albüm sayılmaz.',
  back: '‹ Geri',
  trackMenu: 'Parça seçenekleri',

  screen: {
    viewSwitch: 'Kütüphane görünümü',
    searchHints: {
      tracks: 'Parça adı, sanatçı ve etiket ara',
      albums: 'Parça adı, sanatçı ve etiket ara',
      artists: 'Sanatçı ara',
      folders: 'Klasör ara',
    },
    sort: 'Sıralama',
    sortShort: { name: 'A–Z', added: 'Eklenme', played: 'Dinlenme' },
    sortedBy: {
      name: 'Ada göre sıralı',
      added: 'Eklenme zamanına göre sıralı',
      played: 'Son dinlenme zamanına göre sıralı',
    },
    sortHint: 'Kütüphanenin sıralamasını değiştirir',
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

    needsAccess: 'Jukebox’ın bu cihazdaki seslere erişmesi gerekiyor.',
    nothingIn: (folder) => `${folder} klasöründe hiçbir şey yok.`,
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
  },

  menu: {
    playNext: { label: 'Sonraki olarak çal', hint: 'Çalan parçanın hemen ardından' },
    addToQueue: { label: common.addToQueue, hint: 'En sona' },
    album: { label: 'Albüme git', hint: 'Albümün geri kalanı, sırasıyla' },
    addToPlaylist: { label: 'Listeye ekle', hint: 'Listelerinden biri ya da yeni bir liste' },
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
};
