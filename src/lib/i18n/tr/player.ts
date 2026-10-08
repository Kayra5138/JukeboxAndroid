import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const player: Strings['player'] = {
  bar: {
    opensPlayer: 'Oynatıcıyı açar',
  },
  sheet: {
    nothingPlaying: 'Çalan bir şey yok.',
    repeat: { off: 'Tekrarla', all: 'Tümünü tekrarla', one: 'Tek parçayı tekrarla' },
    back: (seconds) => `${seconds} saniye geri`,
    forward: (seconds) => `${seconds} saniye ileri`,
    shuffleQueue: 'Sırayı karıştır',
    playbackSettings: 'Oynatma ayarları',
    lyrics: 'Sözler',
    translateLyrics: 'Sözleri çevir',
    upNext: (count) => `Sıradaki · ${format.number(count)}`,
  },
  queue: {
    remove: (title) => `${title} parçasını kaldır`,
  },
  settings: {
    playback: 'Oynatma',
    backToNormal: 'Hızı ve perdeyi normale döndür',
    normal: 'Normal',
    speed: 'Hız',
    pitch: 'Perde',
    pitchHint: 'Yarım ses olarak, yukarı ya da aşağı; kayıt yine üstteki hızda çalar.',
    effects: 'Efektler',
    equalizer: { note: 'Bantlar, bas ve ses yüksekliği' },
    crossfade: { note: 'Bir parçanın yerini sonrakine nasıl bıraktığı' },
    allEffects: { title: 'Tüm efektler', note: 'Genişlik, crossfeed, döndürme ve seviye' },
  },
  sleepTimer: {
    title: 'Uyku zamanlayıcısı',
    cancel: 'Uyku zamanlayıcısını iptal et',
    unsupported: 'Uyku zamanlayıcısını kullanmak için güncel sürümü yükle.',
    about: 'Müziği bir süre sonra duraklatır. Son yarım dakikada ses giderek kısılır.',
    pauseAfter: (minutes) => `${minutes} dakika sonra duraklat`,
    pauseAfterTyped: 'Yazacağın dakika kadar sonra duraklat',
    custom: 'Özel…',
    pauseAtEnd: 'Bu parçanın sonunda duraklat',
    endOfTrack: 'Parça sonu',
    finish: {
      title: 'Çalan parça bitsin',
      note: 'Süre dolduğunda ses kısılarak kesilmez, şarkının bitmesi beklenir.',
      label: 'Uyku zamanlayıcısı dolduğunda çalan parça bitsin',
    },
    refused: (most) => `1 ile ${most} arasında bir tam sayı gir`,
    howMany: 'Kaç dakika sonra duraklatılsın?',
    minutes: 'Dakika',
    start: 'Başlat',
  },
  sleep: {
    endOfTrack: 'Bu parça bitince duraklar',
    thenToTheEnd: (time) => `${time} kaldı, ardından parçanın sonuna kadar`,
    fadingOut: (time) => `Ses kısılıyor, ${time} kaldı`,
    pausesIn: (time) => `${time} sonra duraklar`,
  },
};
