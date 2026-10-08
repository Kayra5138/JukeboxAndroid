import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const backup: Strings['backup'] = {
  imported: 'İçe aktarıldı',
  importedBody:
    'Her şey aktarıldı. Bunları gösterebilmesi için Jukebox’ın yeniden başlaması gerekiyor: şu anda ekranda olanlar içe aktarmadan önce okunmuştu.',
  restart: 'Jukebox’ı yeniden başlat',

  question: 'Bu yedek içe aktarılsın mı?',
  made: (when, app) =>
    when
      ? app
        ? `${when} tarihinde Jukebox ${app} ile alındı.`
        : `${when} tarihinde alındı.`
      : app
        ? `Jukebox ${app} ile alınmış bir yedek.`
        : 'Bir yedek.',
  listens: (count) => `${format.number(count)} dinleme`,
  tagged: (count) => `${format.number(count)} etiketli şarkı`,
  withLyrics: (count) => `${format.number(count)} sözlü şarkı`,

  songs: (found, total) => {
    if (total === 0) return 'İçinde hiçbir şarkı geçmiyor.';
    const missing = total - found;
    const here = `İçindeki ${format.number(total)} şarkıdan ${format.number(found)} tanesi kütüphanende.`;
    return missing > 0
      ? `${here} Kalan ${format.number(missing)} şarkı bu telefonda yok. Dinlemeleri korunur; ama etiketleri, sözleri ve listelerdeki yerleri bağlanacak bir şarkı olmadığı için dışarıda bırakılır.`
      : here;
  },

  importing: 'İçe aktarılıyor…',
  merge: 'Birleştir',
  mergeHint: 'Burada olanlara ekler. Bu telefondan hiçbir şey silinmez.',
  replace: 'Değiştir',
  replaceHint: 'Burada olanları siler ve yerine yedeği koyar. Bu işlem geri alınamaz.',

  notABackup: 'Bu dosya bir Jukebox yedeği değil.',
  newer: 'Bu yedek daha yeni bir Jukebox ile alınmış. Okuyabilmek için uygulamayı güncelle.',
  needsBuildToExport: 'Dışa aktarmak için güncel sürümü yükle.',
  needsBuildToImport: 'İçe aktarmak için güncel sürümü yükle.',
};
