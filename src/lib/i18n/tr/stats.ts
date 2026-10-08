import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import type { PeriodId } from '../../stats/period.ts';

/*
  A period is not one word dropped into three sentences here: it is "bugün" in
  one, "düne göre" in another and "bugünün" in a third, so every sentence is
  written out for every period.
*/
const by = (period: PeriodId, said: Record<PeriodId, string>) => said[period];

const arrow = (change: number) => (change >= 0 ? '↑' : '↓');

const weekdays = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const months = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

export const stats: Strings['stats'] = {
  percent: (value) => `%${value}`,

  period: {
    labels: { day: 'Gün', week: 'Hafta', month: 'Ay', year: 'Yıl', all: 'Tümü' },
    today: 'Bugün',
    thisWeek: 'Bu hafta',
    allTime: 'Tüm zamanlar',
    monthOf: (date) => `${format.monthsShort[date.getMonth()]} ${date.getFullYear()}`,
    versus: (period) =>
      by(period, {
        day: 'düne göre',
        week: 'geçen haftaya göre',
        month: 'geçen aya göre',
        year: 'geçen yıla göre',
        all: '',
      }),
  },

  /*
    Written tight, `4sa 12dk`, as the English is: these sit in a headline and
    in cards a few characters wide, where the spaced form does not fit.
  */
  duration: {
    seconds: (seconds) => `${seconds}sn`,
    minutes: (minutes) => `${minutes}dk`,
    hours: (hours) => `${hours}sa`,
    hoursMinutes: (hours, minutes) => `${hours}sa ${minutes}dk`,
  },

  figures: {
    plays: 'Dinlenme',
    tracks: 'Parça',
    artists: 'Sanatçı',
    finished: 'Tamamlanan',
    aDay: 'Günlük',
    peakHour: 'En yoğun saat',
    streak: 'Seri',
    days: (count) => `${count} gün`,
  },

  chart: {
    day: (date) =>
      `${date.getDate()} ${months[date.getMonth()]} ${weekdays[(date.getDay() + 6) % 7]}`,
    month: (date) => `${months[date.getMonth()]} ${date.getFullYear()}`,
  },

  screen: {
    emptyTitle: 'Henüz bir şey dinlenmedi.',
    emptyBody:
      'Bir parça, otuz saniyesini dinlediğinde sayılır; bir dakikadan kısa parçalarda yarısı yeterlidir.',
    recap: 'Özet',
    openRecap: 'Özetini aç',
    changeFigure: (change) => `${arrow(change)} %${Math.abs(change)}`,
    against: (comparison, before) => (before ? `${comparison} · ${before}` : comparison),
    nothingYet: 'Bu dönemde henüz bir şey yok',
    time: 'Süre',
    plays: 'Dinlenme',
    playsCount: (count) => `${count} dinlenme`,
    was: (before) => `önceki: ${before}`,
    lists: { tracks: 'Parçalar', artists: 'Sanatçılar', genres: 'Türler' },
    lookUpForGenres: 'Türlerin toplanması için parçaların bilgilerini ara.',
    nothingInPeriod: 'Bu dönemde bir şey yok.',
  },

  report: {
    tracksHeading: 'En çok dinlediğin parçalar',
    tracksLead: (period) =>
      by(period, {
        day: 'Bugün en çok dinlediklerin',
        week: 'Bu hafta en çok dinlediklerin',
        month: 'Bu ay en çok dinlediklerin',
        year: 'Bu yıl en çok dinlediklerin',
        all: 'Bugüne kadar en çok dinlediklerin',
      }),
    artistsHeading: 'En çok dinlediğin sanatçılar',
    artistsLead: (period) =>
      by(period, {
        day: 'Bugün sana eşlik edenler',
        week: 'Bu hafta sana eşlik edenler',
        month: 'Bu ay sana eşlik edenler',
        year: 'Bu yıl sana eşlik edenler',
        all: 'Bugüne kadar sana eşlik edenler',
      }),
    genresHeading: 'Tarzın',
    genresLead: (period) =>
      by(period, {
        day: 'Bugünün havası',
        week: 'Bu haftanın havası',
        month: 'Bu ayın havası',
        year: 'Bu yılın havası',
        all: 'Bugüne kadarki havan',
      }),
    clockHeading: 'Saatlerin',
    clockLead: (hour) => `En çok ${hour} sularında dinledin`,
    numbersHeading: 'Rakamlarla',
    streakDays: (count) => `${count} gün`,
  },

  cards: {
    listenedFor: 'Dinleme süren',
    change: (change, comparison) => `${comparison} ${arrow(change)} %${Math.abs(change)}`,
    numberOne: 'BİR NUMARA',
    plays: (count) => `${count} dinlenme`,
    mostPlayed: 'En çok dinlenen',
    mostPlayedArtist: 'En çok dinlenen sanatçı',
    credit: (photographer, licence) => `Fotoğraf: ${photographer} / ${licence}`,
    creditUnnamed: (licence) => `Fotoğraf: ${licence}`,
  },

  viewer: {
    share: 'Paylaş',
    saved: 'Galerine kaydedildi.',
    cannotSave: 'Resimleri kaydetmek için güncel sürümü yükle.',
    cannotShare: 'Resimleri paylaşmak için güncel sürümü yükle.',
    failed: 'İşlem başarısız oldu. Lütfen yeniden dene.',
  },
};
