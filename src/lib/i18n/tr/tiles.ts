import type { Strings } from '../en/index.ts';

export const tiles: Strings['tiles'] = {
  speeds: { easy: 'Kolay', normal: 'Normal', hard: 'Zor', harder: 'Daha zor' },

  setup: {
    title: 'Eşlik et',
    noTrack: 'Bir parça başlat; tuşlar ondan oluşturulur.',
    making: 'Parça dinleniyor…',
    missing: 'Bu parça okunamıyor.',
    record: (title, keys) => `${title ?? 'Bu parça'} — ${keys} tuş`,
    latency:
      'Ses kablosuz kulaklığa gecikmeli ulaşır. Tuşlar müziğin gerisinde kalıyorsa, ikisi uyuşana kadar bunu ayarla.',
    earlier: '−20 ms',
    later: '+20 ms',
    offset: (ms) => `${ms} ms`,
    start: 'Baştan çal',
    starting: 'Başlatılıyor…',
  },

  pause: {
    title: 'Duraklatıldı',
    resume: 'Devam et',
    toMenu: 'Menüye dön',
  },

  ending: {
    clean: 'Kusursuz tur',
    won: 'Başardın',
    over: 'Tur bitti',
    lapse: 'Bir tuşu kaçırdın.',
    empty: 'O dokunuş boşa gitti.',
    toTheEnd: 'Parçanın sonuna kadar geldin.',
    figures: (hit, total, held, best, percent) =>
      `${total} tuştan ${hit}${held > 0 ? ` · ${held} basılı tutma` : ''} · en uzun seri ${best} · %${percent}`,
    again: 'Yeniden',
  },
};
