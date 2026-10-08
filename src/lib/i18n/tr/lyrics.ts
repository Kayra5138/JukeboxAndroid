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
};
