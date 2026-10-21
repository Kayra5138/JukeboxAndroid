import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const lyrics: Strings['lyrics'] = {
  none: 'Şarkı sözü bulunamadı.',
  translating: 'Çevriliyor…',
  seekTo: (seconds) => `Şu ana git: ${seconds} sn`,

  translation: {
    romaji:
      'Bunlar Latin harfleriyle yazılmış Japonca sözler; bunların yerine çevrilecek, özgün yazıyla bir kayıt da bulunamadı.',
    unsupported: 'Bu dil için çeviri yok.',
    unavailable: 'Çeviri bu cihazda kullanılamıyor.',
    misaligned: 'Çeviri satırlarla eşleşmedi.',
    failed: 'Çeviri başarısız oldu.',
  },

  from: {
    file: 'Dosyadan',
    lrc: '.lrc dosyasından',
    lookup: 'LRCLIB’den',
  },

  stored: (timed, from, lines) =>
    `${timed ? 'Zamanlı' : 'Düz metin'}, ${from === 'file' ? 'dosyanın kendisinden' : 'yanındaki .lrc dosyasından'}` +
    (lines > 0 ? ` · ${format.number(lines)} satır` : ''),

  found: {
    file: 'Dosyanın kendisinde bulundu ve kaydedildi.',
    lrc: 'Şarkının yanındaki bir .lrc dosyasında bulundu ve kaydedildi.',
  },

  folders: {
    title: 'Şarkıların yanındaki .lrc dosyalarını oku',
    note: 'Şarkıyla aynı adı taşıyan bir .lrc dosyasındaki sözler, internette aranmadan önce gösterilir. Android bu dosyaları yalnızca senin seçtiğin bir klasörden okumaya izin verir; bu yüzden müziğinin bulunduğu klasör bir kez sorulur.',
    add: 'Başka bir klasör ekle',
    remove: 'Kaldır',
    removeLabel: (folder) => `${folder} klasöründeki .lrc dosyalarını okumayı bırak`,
    elsewhere: 'Seçtiğin klasör bu telefonda değil, bu yüzden şarkılarından hiçbiri orada olamaz. Telefonda müziğinin bulunduğu klasörü seç.',
  },
};
