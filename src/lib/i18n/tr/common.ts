import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

/*
  A noun after a number stays as it is in Turkish — "1 parça", "3 parça" — so
  every count here is one wording and nothing chooses between two.
*/
export const common: Strings['common'] = {
  cancel: 'İptal',
  save: 'Kaydet',
  done: 'Bitti',
  ok: 'Tamam',
  close: 'Kapat',
  back: 'Geri',
  delete: 'Sil',
  remove: 'Kaldır',
  add: 'Ekle',
  edit: 'Düzenle',
  rename: 'Yeniden adlandır',
  yes: 'Evet',
  no: 'Hayır',
  tryAgain: 'Yeniden dene',
  retry: 'Yeniden dene',
  import: 'İçe aktar',
  clear: 'Temizle',
  selectAll: 'Tümünü seç',
  off: 'Kapalı',
  saved: 'Kaydedildi.',
  loading: 'Yükleniyor…',

  search: 'Ara',
  clearSearch: 'Aramayı temizle',

  play: 'Çal',
  pause: 'Duraklat',
  nextTrack: 'Sonraki parça',
  previousTrack: 'Önceki parça',
  shuffle: 'Karıştır',
  addToQueue: 'Sıraya ekle',

  unknownArtist: 'Bilinmeyen sanatçı',
  unknownAlbum: 'Bilinmeyen albüm',

  tracks: (count) => `${format.number(count)} parça`,
  songs: (count) => `${format.number(count)} şarkı`,
  albums: (count) => `${format.number(count)} albüm`,
  artists: (count) => `${format.number(count)} sanatçı`,
  lists: (count) => `${format.number(count)} liste`,
  files: (count) => `${format.number(count)} dosya`,
  minutes: (count) => `${format.number(count)} dk`,
  hours: (count) => `${format.number(count)} sa`,

  fileUnreadable: 'Bu dosya okunamadı.',
  pictureFailed: 'Bu resim yüklenemedi.',

  drawFailed: 'Bu ekran görüntülenirken bir sorun oluştu.',
};
